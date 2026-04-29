export type CrawlRunStatus = 'queued' | 'running' | 'success' | 'failed';

export interface CrawlRun {
  id: string;
  projectId: string;
  status: CrawlRunStatus;
  startedAt: string;
  finishedAt?: string | null;
  errorMessage?: string | null;
  scriptPath: string;
  rawDataPath: string;
}

export type GraphNodeKind = 'entry' | 'internal' | 'failed';

export interface GraphNode {
  id: string;
  label: string;
  url: string;
  kind: GraphNodeKind;
  hash: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface Graph {
  runId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
