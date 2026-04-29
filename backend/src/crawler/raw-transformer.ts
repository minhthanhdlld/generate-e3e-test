export interface RawCrawlPage {
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

export interface RawCrawlOutput {
  entryUrl: string;
  pages: RawCrawlPage[];
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

export function transformRawCrawl(raw: RawCrawlOutput): TransformedGraph {
  const seen = new Set<string>();
  const nodes: NodeRow[] = [];
  const edges: EdgeRow[] = [];

  for (const p of raw.pages) {
    if (!seen.has(p.url)) {
      seen.add(p.url);
      nodes.push({
        url: p.url,
        title: p.title,
        parentUrl: p.parent,
        failed: p.failed,
        metadata: {
          depth: p.depth,
          forms: p.forms,
          buttons: p.buttons,
          anchors: p.anchors,
          screenshot: p.screenshot,
          error: p.error,
        },
      });
    }
  }

  for (const p of raw.pages) {
    if (!p.parent) continue;
    edges.push({
      fromUrl: p.parent,
      toUrl: p.url,
      triggerLabel: 'navigate',
    });
  }

  return { entryUrl: raw.entryUrl, nodes, edges };
}
