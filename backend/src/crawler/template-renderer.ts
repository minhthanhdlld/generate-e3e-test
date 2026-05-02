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
  // Per-step navigation/operation timeout.
  timeoutMs: number;
  // Hard deadline for the whole crawl (ms). When exceeded, BFS stops, raw JSON
  // is flushed, and the script exits 0 with whatever it has so far.
  maxDurationMs: number;
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
const MAX_DURATION_MS = {{maxDurationMs}};
const DEADLINE = Date.now() + MAX_DURATION_MS;
const OUTPUT_JSON = process.env.VERIFAI_OUTPUT_JSON ?? {{json outputJsonPath}};
const SCREENSHOTS_DIR = {{json screenshotsDir}};

function timeBudgetExpired(): boolean {
  return Date.now() >= DEADLINE;
}

async function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race<T>([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout: ' + label)), ms),
    ),
  ]);
}

interface PageInfo {
  url: string;
  title: string;
  depth: number;
  parent: string | null;
  // Anchor text on the parent that led to this page. 'entry' for the very first
  // page, 'after-login' for the post-login entry. Empty if the anchor had no text.
  triggerText: string;
  // 'pre-login' for pages discovered before/around the login screen, 'post-login'
  // for pages discovered after authentication succeeded.
  phase: 'pre-login' | 'post-login';
  forms: Array<{ action: string; method: string; inputs: string[] }>;
  buttons: string[];
  anchors: Array<{ href: string; text: string; trigger: string }>;
  screenshot: string | null;
  failed: boolean;
  error?: string;
}

interface QueueItem {
  url: string;
  depth: number;
  parent: string | null;
  triggerText: string;
  phase: 'pre-login' | 'post-login';
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

interface LoginDiag {
  attempted: boolean;
  userFieldFound: boolean;
  passFieldFound: boolean;
  submitFound: boolean;
  urlBefore: string;
  urlAfter: string;
  succeeded: boolean;
  reason?: string;
}

async function flushAndExit(
  visited: Map<string, PageInfo>,
  entryUrl: string,
  loginDiag: LoginDiag,
  exitCode: number,
): Promise<never> {
  const out = { entryUrl, loginDiag, pages: Array.from(visited.values()) };
  try {
    writeFileSync(OUTPUT_JSON, JSON.stringify(out, null, 2), 'utf8');
  } catch (err) {
    console.error('[crawl] failed to write output JSON:', err);
  }
  process.exit(exitCode);
}

// Wait until the URL no longer matches a login route, or until ms expires.
// Resolves true if URL changed off the login page; false otherwise.
async function waitForLoginRedirect(page: any, fromUrl: string, ms: number): Promise<boolean> {
  const start = Date.now();
  const fromPath = (() => {
    try { return new URL(fromUrl).pathname; } catch { return fromUrl; }
  })();
  while (Date.now() - start < ms) {
    const cur = page.url();
    let curPath: string;
    try { curPath = new URL(cur).pathname; } catch { curPath = cur; }
    if (curPath !== fromPath && !/\\/(?:auth\\/)?(?:sign[-_]?in|log[-_]?in|login)(?:\\/|$|\\?)/i.test(curPath)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function crawlOnePage(
  page: any,
  item: QueueItem,
  queue: QueueItem[],
  visited: Map<string, PageInfo>,
  entryOriginUrl: string,
): Promise<void> {
  const info: PageInfo = {
    url: item.url,
    title: '',
    depth: item.depth,
    parent: item.parent,
    triggerText: item.triggerText,
    phase: item.phase,
    forms: [],
    buttons: [],
    anchors: [],
    screenshot: null,
    failed: false,
  };
  try {
    await withDeadline(
      page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: Math.min(TIMEOUT_MS, 20_000) }).then(() => undefined),
      Math.min(TIMEOUT_MS, 20_000),
      'goto ' + item.url,
    );
    await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => {});
    info.url = page.url();
    info.title = await page.title();

    info.forms = await page.$$eval('form', (forms: any[]) =>
      forms.map((f) => ({
        action: (f as HTMLFormElement).getAttribute('action') ?? '',
        method: ((f as HTMLFormElement).getAttribute('method') ?? 'GET').toUpperCase(),
        inputs: Array.from(f.querySelectorAll('input,select,textarea'))
          .map((i: any) => (i as HTMLInputElement).getAttribute('name') ?? '')
          .filter(Boolean),
      })),
    );
    info.buttons = await page.$$eval('button, input[type="submit"], input[type="button"]', (btns: any[]) =>
      btns.map((b: any) => (b.textContent ?? (b as HTMLInputElement).value ?? '').trim()).filter(Boolean),
    );
    info.anchors = await page.$$eval(
      'a[href], [routerLink], [routerlink], [ng-reflect-router-link]',
      (els: any[], baseHref: string) => {
        const out: Array<{ href: string; text: string; trigger: string }> = [];
        const base = baseHref || (typeof window !== 'undefined' ? window.location.href : '');
        for (const el of els) {
          let href = '';
          const tag = el.tagName.toLowerCase();
          if (tag === 'a' && (el as HTMLAnchorElement).href) {
            href = (el as HTMLAnchorElement).href;
          }
          if (!href) {
            const rl = el.getAttribute('routerLink')
              ?? el.getAttribute('routerlink')
              ?? el.getAttribute('ng-reflect-router-link')
              ?? '';
            if (rl) {
              try { href = new URL(rl, base).toString(); } catch { href = ''; }
            }
          }
          if (!href) continue;
          const text = (el.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 80);
          out.push({
            href,
            text,
            trigger: 'Click "' + (text || href) + '"',
          });
        }
        const seen = new Set<string>();
        return out.filter((a) => (seen.has(a.href) ? false : (seen.add(a.href), true)));
      },
      page.url(),
    );

    const hash = sha1(info.url);
    const shotPath = join(SCREENSHOTS_DIR, hash + '.png');
    await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});
    info.screenshot = shotPath;

    // enqueue same-origin children
    if (item.depth < MAX_DEPTH) {
      for (const a of info.anchors) {
        try {
          const abs = new URL(a.href, info.url).toString();
          if (sameOrigin(abs, entryOriginUrl) && !visited.has(abs) && !queue.find((q) => q.url === abs)) {
            queue.push({
              url: abs,
              depth: item.depth + 1,
              parent: info.url,
              triggerText: a.text,
              phase: item.phase,
            });
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

async function drainQueue(
  page: any,
  queue: QueueItem[],
  visited: Map<string, PageInfo>,
  entryOriginUrl: string,
): Promise<void> {
  while (queue.length > 0 && visited.size < MAX_PAGES) {
    if (timeBudgetExpired()) {
      console.warn('[crawl] deadline reached after ' + visited.size + ' page(s); flushing');
      break;
    }
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    await crawlOnePage(page, item, queue, visited, entryOriginUrl);
  }
}

(async () => {
  mkdirSync(dirname(OUTPUT_JSON), { recursive: true });
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  // Per-action navigation timeout — keeps individual goto/click capped.
  page.setDefaultTimeout(Math.min(TIMEOUT_MS, 20_000));
  page.setDefaultNavigationTimeout(Math.min(TIMEOUT_MS, 20_000));

  const visited = new Map<string, PageInfo>();
  let entryUrl = TARGET_URL;

  const loginDiag: LoginDiag = {
    attempted: false,
    userFieldFound: false,
    passFieldFound: false,
    submitFound: false,
    urlBefore: TARGET_URL,
    urlAfter: TARGET_URL,
    succeeded: false,
  };

  // ----- Phase A: capture pre-login pages (login screen + same-origin links from it) -----
  const preLoginQueue: QueueItem[] = [
    { url: TARGET_URL, depth: 0, parent: null, triggerText: 'entry', phase: 'pre-login' },
  ];
  await drainQueue(page, preLoginQueue, visited, TARGET_URL);

  if (timeBudgetExpired()) {
    console.warn('[crawl] deadline reached after pre-login phase');
    await browser.close().catch(() => {});
    await flushAndExit(visited, entryUrl, loginDiag, 0);
  }

  // ----- Phase B: navigate back to the login URL and attempt login -----
  try {
    await withDeadline(
      page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' }).then(() => undefined),
      Math.min(TIMEOUT_MS, 20_000),
      'goto target',
    );
    // Wait for SPA hydration aggressively — Angular needs network idle to render the form.
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});

    loginDiag.urlBefore = page.url();

    const userField = page.locator(
      'input[type="email"], input[type="text"][formcontrolname*="user" i], input[type="text"][formcontrolname*="email" i], input[formcontrolname="username"], input[formcontrolname="email"], input[name*="user" i], input[name*="email" i], input[name="username"]',
    ).first();
    const passField = page.locator('input[type="password"]').first();

    // Wait for the password field to actually exist — Angular forms only appear after hydration.
    await passField.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    loginDiag.userFieldFound = (await userField.count().catch(() => 0)) > 0;
    loginDiag.passFieldFound = (await passField.count().catch(() => 0)) > 0;

    if (loginDiag.userFieldFound && loginDiag.passFieldFound) {
      loginDiag.attempted = true;
      await userField.fill(USERNAME).catch(() => {});
      await passField.fill(PASSWORD).catch(() => {});

      const submit = page.locator(
        'button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login"), button:has-text("Continue"), button:has-text("Submit")',
      ).first();
      loginDiag.submitFound = (await submit.count().catch(() => 0)) > 0;

      // Try button click; fall back to pressing Enter on the password field.
      if (loginDiag.submitFound) {
        await submit.click({ timeout: 5_000 }).catch(() => {});
      } else {
        await passField.press('Enter').catch(() => {});
      }

      // Wait up to 30s for the URL to leave the login route. SPAs usually need
      // 2-5s for the API call + router navigation.
      const redirected = await waitForLoginRedirect(page, loginDiag.urlBefore, 30_000);

      // After URL changes (or fallback), give the new view a chance to render.
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});

      loginDiag.urlAfter = page.url();
      loginDiag.succeeded = redirected;
      if (!redirected) {
        loginDiag.reason = 'Did not leave login route within 30s — credentials wrong or submit handler did not fire';
      }
    } else {
      loginDiag.reason = 'Could not find username and/or password field';
    }
    entryUrl = page.url();
  } catch (err) {
    loginDiag.reason = 'login phase exception: ' + (err instanceof Error ? err.message : String(err));
    console.error('[crawl] login phase error:', err instanceof Error ? err.message : err);
  }

  console.log('[crawl] login diagnostic:', JSON.stringify(loginDiag));

  if (timeBudgetExpired()) {
    console.warn('[crawl] deadline reached during login phase');
    await browser.close().catch(() => {});
    await flushAndExit(visited, entryUrl, loginDiag, 0);
  }

  // ----- Phase C: post-login BFS, only if login actually succeeded -----
  if (loginDiag.succeeded) {
    const postLoginUrl = page.url();
    if (!visited.has(postLoginUrl)) {
      const postLoginQueue: QueueItem[] = [
        { url: postLoginUrl, depth: 0, parent: null, triggerText: 'after-login', phase: 'post-login' },
      ];
      await drainQueue(page, postLoginQueue, visited, postLoginUrl);
    }
  }

  await browser.close().catch(() => {});
  await flushAndExit(visited, entryUrl, loginDiag, 0);
})().catch((err) => {
  console.error('[crawl] fatal:', err);
  process.exit(1);
});
`;

const compiled = Handlebars.compile(CRAWL_SCRIPT, { noEscape: true });

export function renderCrawlScript(vars: CrawlScriptVars): string {
  return compiled(vars);
}
