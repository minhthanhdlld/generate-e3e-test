import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { UiNode } from './entities/ui-node.entity';
import { UiEdge } from './entities/ui-edge.entity';
import { CrawlRun } from '../crawler/entities/crawl-run.entity';
import { ProjectsService } from '../projects/projects.service';

export interface GraphNodeOut {
  id: string;
  label: string;
  url: string;
  kind: 'entry' | 'internal' | 'failed';
  hash: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdgeOut {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface GraphOut {
  runId: string;
  nodes: GraphNodeOut[];
  edges: GraphEdgeOut[];
}

// Convert a URL into a friendly component name when no anchor text is available.
//   /auth/login                       → "Login"
//   /auth/forgot-password             → "Forgot Password"
//   /customers-&-jobs/customer        → "Customer"
//   /human-resources/out-of-office    → "Out Of Office"
//   /                                 → "Home"
//   /error/403                        → "403"
function componentNameFromUrl(rawUrl: string): string {
  let path = '';
  try {
    path = new URL(rawUrl).pathname;
  } catch {
    return rawUrl;
  }
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  if (trimmed.length === 0) return 'Home';
  const last = trimmed.split('/').pop() ?? trimmed;
  return last
    .replace(/[-_+]+/g, ' ')
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .trim();
}

// Resolve the user-facing component name with a clear precedence chain.
function resolveComponentName(node: UiNode): string {
  const meta = (node.metadata ?? {}) as Record<string, unknown>;
  const triggerText = ((meta.triggerText as string | undefined) ?? '').trim();
  if (
    triggerText.length > 0 &&
    triggerText !== 'entry' &&
    triggerText !== 'after-login'
  ) {
    return triggerText;
  }
  // Synthetic / empty trigger → derive from URL.
  const fromUrl = componentNameFromUrl(node.url);
  if (fromUrl && fromUrl.length > 0) return fromUrl;
  if (node.title && node.title.trim().length > 0) return node.title.trim();
  return node.url;
}

@Injectable()
export class UiGraphService {
  constructor(
    @InjectRepository(UiNode) private readonly nodes: Repository<UiNode>,
    @InjectRepository(UiEdge) private readonly edges: Repository<UiEdge>,
    @InjectRepository(CrawlRun) private readonly runs: Repository<CrawlRun>,
    private readonly projectsSvc: ProjectsService,
  ) {}

  async getGraph(
    projectId: string,
    ownerId: string,
    runId?: string,
  ): Promise<GraphOut | null> {
    await this.projectsSvc.findEntityOwnedOrThrow(projectId, ownerId);

    const run = runId
      ? await this.runs.findOne({ where: { id: runId, projectId } })
      : await this.runs.findOne({
          where: { projectId, status: 'success' },
          order: { startedAt: 'DESC' },
        });
    if (!run) return null;

    const nodes = await this.nodes.find({ where: { crawlRunId: run.id } });
    const edges = await this.edges.find({ where: { crawlRunId: run.id } });

    if (nodes.length === 0) {
      return { runId: run.id, nodes: [], edges: [] };
    }

    // Find entry node = the one with no parentNodeId (first in BFS).
    const entry = nodes.find((n) => !n.parentNodeId) ?? nodes[0];

    const outNodes: GraphNodeOut[] = nodes.map((n) => ({
      id: n.id,
      label: resolveComponentName(n),
      url: n.url,
      kind:
        n.id === entry.id
          ? 'entry'
          : (n.metadata as Record<string, unknown>)?.error
            ? 'failed'
            : 'internal',
      hash: createHash('sha1').update(n.url).digest('hex'),
      metadata: n.metadata as Record<string, unknown>,
    }));

    const outEdges: GraphEdgeOut[] = edges.map((e) => ({
      id: e.id,
      from: e.fromNodeId,
      to: e.toNodeId,
      label: e.triggerLabel,
    }));

    return { runId: run.id, nodes: outNodes, edges: outEdges };
  }
}
