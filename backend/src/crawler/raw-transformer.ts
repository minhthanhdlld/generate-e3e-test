export interface RawCrawlPage {
  url: string;
  title: string;
  depth: number;
  parent: string | null;
  // Anchor text on the parent that led here. 'entry' / 'after-login' for the
  // two crawl entry points. May be empty when the originating anchor had no text.
  triggerText?: string;
  // 'pre-login' or 'post-login'. Older raw JSON may omit this.
  phase?: 'pre-login' | 'post-login';
  forms: Array<{ action: string; method: string; inputs: string[] }>;
  buttons: string[];
  anchors: Array<{ href: string; text: string; trigger: string }>;
  screenshot: string | null;
  failed: boolean;
  error?: string;
}

export interface LoginDiagnostic {
  attempted: boolean;
  userFieldFound: boolean;
  passFieldFound: boolean;
  submitFound: boolean;
  urlBefore: string;
  urlAfter: string;
  succeeded: boolean;
  reason?: string;
}

export interface RawCrawlOutput {
  entryUrl: string;
  pages: RawCrawlPage[];
  // Optional — only present in v2+ crawl scripts. Older raw JSON omits it.
  loginDiag?: LoginDiagnostic;
}

export interface NodeRow {
  url: string;
  title: string;
  parentUrl: string | null;
  metadata: Record<string, unknown>;
  failed: boolean;
}

export interface EdgeRow {
  fromUrl: string;
  toUrl: string;
  triggerLabel: string;
}

export interface TransformedGraph {
  entryUrl: string;
  nodes: NodeRow[];
  edges: EdgeRow[];
}

// Build a map of url → page title so we can resolve "default URL" anchors
// to a friendlier display string at ingest time.
function buildTitleMap(raw: RawCrawlOutput): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of raw.pages) {
    if (p.title && p.title.trim().length > 0) {
      m.set(p.url, p.title.trim());
    }
  }
  return m;
}

// Resolve the human label for an anchor / edge:
//   1. anchor's own visible text
//   2. otherwise: target page's <title> (if we visited it)
//   3. otherwise: the raw href
function resolveDisplayText(
  anchorText: string | undefined,
  targetUrl: string,
  titleByUrl: Map<string, string>,
): string {
  const t = (anchorText ?? '').trim();
  if (t.length > 0) return t;
  const fromTitle = titleByUrl.get(targetUrl);
  if (fromTitle) return fromTitle;
  return targetUrl;
}

export function transformRawCrawl(raw: RawCrawlOutput): TransformedGraph {
  const titleByUrl = buildTitleMap(raw);
  const seen = new Set<string>();
  const nodes: NodeRow[] = [];
  const edges: EdgeRow[] = [];

  for (const p of raw.pages) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);

    // Decorate each anchor with `displayText` (text → target title → href) so
    // the FE drawer can render a friendly label without re-walking the graph.
    const decoratedAnchors = (p.anchors ?? []).map((a) => ({
      ...a,
      displayText: resolveDisplayText(a.text, a.href, titleByUrl),
    }));

    nodes.push({
      url: p.url,
      title: p.title,
      parentUrl: p.parent,
      failed: p.failed,
      metadata: {
        depth: p.depth,
        phase: p.phase ?? 'post-login',
        triggerText: p.triggerText ?? '',
        forms: p.forms,
        buttons: p.buttons,
        anchors: decoratedAnchors,
        screenshot: p.screenshot,
        error: p.error,
      },
    });
  }

  for (const p of raw.pages) {
    if (!p.parent) continue;
    // Edge label uses the same fallback chain: anchor text → target page title → href.
    const triggerText = (p.triggerText ?? '').trim();
    const label =
      triggerText.length > 0 && triggerText !== 'entry' && triggerText !== 'after-login'
        ? triggerText
        : (titleByUrl.get(p.url) ?? p.url);
    edges.push({
      fromUrl: p.parent,
      toUrl: p.url,
      triggerLabel: `Click "${label}"`,
    });
  }

  return { entryUrl: raw.entryUrl, nodes, edges };
}
