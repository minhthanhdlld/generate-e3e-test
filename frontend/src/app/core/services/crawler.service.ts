import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CrawlRun, Graph } from '../models/crawl.model';

@Injectable({ providedIn: 'root' })
export class CrawlerApiService {
  private readonly api = inject(ApiService);

  startCrawl(projectId: string): Observable<{ id: string; status: string; startedAt: string }> {
    return this.api.post(`/projects/${projectId}/crawl`, {});
  }

  listRuns(projectId: string): Observable<CrawlRun[]> {
    return this.api.get<CrawlRun[]>(`/projects/${projectId}/crawls`);
  }

  getRun(projectId: string, runId: string): Observable<CrawlRun> {
    return this.api.get<CrawlRun>(`/projects/${projectId}/crawls/${runId}`);
  }

  getGraph(projectId: string, runId?: string): Observable<Graph | null> {
    return this.api.get<Graph | null>(
      `/projects/${projectId}/graph`,
      runId ? { runId } : undefined,
    );
  }
}
