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
      label: n.title || n.url,
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
