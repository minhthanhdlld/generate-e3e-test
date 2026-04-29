import * as Handlebars from 'handlebars';

// Register a `json` helper that emits a safe JSON literal. Used to interpolate
// strings (URL, username, password, paths) into the generated TS source.
Handlebars.registerHelper('json', (value: unknown) => {
  return new Handlebars.SafeString(JSON.stringify(value ?? null));
});

export interface CrawlScriptVars {
  url: string;
  username: string;
  password: string;
  maxDepth: number;
  maxPages: number;
  timeoutMs: number;
  outputJsonPath: string;
  screenshotsDir: string;
}

// Embedded Handlebars template — emits a Playwright Chromium crawler that:
//   1. Navigates to {{url}}, attempts a heuristic login.
//   2. BFS-crawls same-origin links up to maxDepth/maxPages.
//   3. Captures per-page metadata (forms, buttons, anchors) + screenshot.
//   4. Writes consolidated raw JSON to outputJsonPath. Exits 0 on success.
const CRAWL_SCRIPT = `import { chromium } from 'playwright';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const TARGET_URL = {{json url}};
const USERNAME = {{json username}};
const PASSWORD = {{json password}};
const MAX_DEPTH = {{maxDepth}};
const MAX_PAGES = {{maxPages}};
const TIMEOUT_MS = {{timeoutMs}};
const OUTPUT_JSON = process.env.VERIFAI_OUTPUT_JSON ?? {{json outputJsonPath}};
const SCREENSHOTS_DIR = {{json screenshotsDir}};

interface PageInfo {
  url: string;
  title: string;
  depth: number;
  parent: string | null;
  forms: Array<{ action: string; method: string; inputs: string[] }>;
  buttons: string[];
  anchors: Array<{ href: string; text: string; trigger: string }>;
  screenshot: string | null;
  failed: boolean;
  error?: string;
}

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

(async () => {
  mkdirSync(dirname(OUTPUT_JSON), { recursive: true });
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);

  const visited = new Map<string, PageInfo>();
  let entryUrl = TARGET_URL;

  // ----- Login attempt (best-effort heuristic) -----
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    const userField = await page.locator('input[type="email"], input[name*="user" i], input[name*="email" i]').first();
    const passField = await page.locator('input[type="password"]').first();
    if ((await userField.count()) > 0 && (await passField.count()) > 0) {
      await userField.fill(USERNAME);
      await passField.fill(PASSWORD);
      const submit = await page.locator('button[type="submit"], input[type="submit"]').first();
      if ((await submit.count()) > 0) {
        await submit.click({ timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUT_MS }).catch(() => {});
      }
    }
    entryUrl = page.url();
  } catch (err) {
    // Login is best-effort; carry on with whatever URL we have.
  }

  // ----- BFS crawl -----
  const queue: Array<{ url: string; depth: number; parent: string | null; trigger: string }> = [
    { url: entryUrl, depth: 0, parent: null, trigger: 'entry' },
  ];

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const { url, depth, parent, trigger } = queue.shift()!;
    if (visited.has(url)) continue;

    const info: PageInfo = {
      url,
      title: '',
      depth,
      parent,
      forms: [],
      buttons: [],
      anchors: [],
      screenshot: null,
      failed: false,
    };

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      info.url = page.url();
      info.title = await page.title();

      info.forms = await page.$$eval('form', (forms) =>
        forms.map((f) => ({
          action: (f as HTMLFormElement).getAttribute('action') ?? '',
          method: ((f as HTMLFormElement).getAttribute('method') ?? 'GET').toUpperCase(),
          inputs: Array.from(f.querySelectorAll('input,select,textarea'))
            .map((i) => (i as HTMLInputElement).getAttribute('name') ?? '')
            .filter(Boolean),
        })),
      );
      info.buttons = await page.$$eval('button, input[type="submit"], input[type="button"]', (btns) =>
        btns.map((b) => (b.textContent ?? (b as HTMLInputElement).value ?? '').trim()).filter(Boolean),
      );
      info.anchors = await page.$$eval('a[href]', (as) =>
        as.map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: (a.textContent ?? '').trim(),
          trigger: ('Click "' + ((a.textContent ?? '').trim() || (a as HTMLAnchorElement).href) + '"'),
        })),
      );

      const hash = sha1(info.url);
      const shotPath = join(SCREENSHOTS_DIR, hash + '.png');
      await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});
      info.screenshot = shotPath;

      // enqueue same-origin children
      if (depth < MAX_DEPTH) {
        for (const a of info.anchors) {
          try {
            const abs = new URL(a.href, info.url).toString();
            if (sameOrigin(abs, entryUrl) && !visited.has(abs) && !queue.find((q) => q.url === abs)) {
              queue.push({ url: abs, depth: depth + 1, parent: info.url, trigger: a.trigger });
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      info.failed = true;
      info.error = err instanceof Error ? err.message : String(err);
    }

    visited.set(info.url, info);
  }

  await browser.close();

  const out = {
    entryUrl,
    pages: Array.from(visited.values()),
  };
  writeFileSync(OUTPUT_JSON, JSON.stringify(out, null, 2), 'utf8');
  process.exit(0);
})().catch((err) => {
  console.error('[crawl] fatal:', err);
  process.exit(1);
});
`;

const compiled = Handlebars.compile(CRAWL_SCRIPT, { noEscape: true });

export function renderCrawlScript(vars: CrawlScriptVars): string {
  return compiled(vars);
}
