import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { CrawlerApiService } from '../../../../../core/services/crawler.service';
import { CrawlRun, Graph, GraphNode } from '../../../../../core/models/crawl.model';
import { UiGraphComponent } from './ui-graph/ui-graph.component';
import { UiGraphNodeDrawerComponent } from './ui-graph-node-drawer/ui-graph-node-drawer.component';
import { StatusPillComponent } from '../../../../../layout/shared/status-pill/status-pill.component';
import { environment } from '../../../../../../environments/environment';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-graph-ui-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UiGraphComponent,
    UiGraphNodeDrawerComponent,
    StatusPillComponent,
  ],
  templateUrl: './graph-ui-tab.component.html',
  styleUrls: ['./graph-ui-tab.component.css'],
})
export class GraphUiTabComponent implements OnInit, OnDestroy {
  @Input({ required: true }) projectId!: string;

  private readonly crawler = inject(CrawlerApiService);
  private readonly auth = inject(AuthService);
  private subs: Subscription[] = [];
  private pollSub?: Subscription;

  runs: CrawlRun[] = [];
  selectedRunId: string | null = null;
  currentRun: CrawlRun | null = null;
  graph: Graph | null = null;
  selectedNode: GraphNode | null = null;
  selectedNodeScreenshotUrl: string | null = null;

  isStarting = false;
  errorMsg = '';

  ngOnInit(): void {
    this.refreshRuns(true);
  }

  refreshRuns(autoLoadLatest: boolean): void {
    this.subs.push(
      this.crawler.listRuns(this.projectId).subscribe({
        next: (rs) => {
          this.runs = rs;
          if (autoLoadLatest && rs.length > 0) {
            const latestSuccess = rs.find((r) => r.status === 'success');
            if (latestSuccess) {
              this.selectedRunId = latestSuccess.id;
              this.loadGraph(latestSuccess.id);
            } else if (rs[0].status === 'queued' || rs[0].status === 'running') {
              this.startPolling(rs[0].id);
            }
          }
        },
        error: (err) => (this.errorMsg = err?.error?.message ?? 'Failed to load runs'),
      }),
    );
  }

  get isRunInProgress(): boolean {
    return this.runs.some((r) => r.status === 'queued' || r.status === 'running');
  }

  startCrawl(): void {
    this.isStarting = true;
    this.errorMsg = '';
    this.subs.push(
      this.crawler.startCrawl(this.projectId).subscribe({
        next: (res) => {
          this.isStarting = false;
          this.refreshRuns(false);
          this.startPolling(res.id);
        },
        error: (err) => {
          this.isStarting = false;
          this.errorMsg = err?.error?.message ?? 'Failed to start crawl';
        },
      }),
    );
  }

  startPolling(runId: string): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(2000)
      .pipe(
        switchMap(() => this.crawler.getRun(this.projectId, runId)),
        takeWhile((r) => r.status !== 'success' && r.status !== 'failed', true),
      )
      .subscribe({
        next: (r) => {
          this.currentRun = r;
          this.runs = this.runs.map((x) => (x.id === r.id ? r : x));
          if (r.status === 'success') {
            this.selectedRunId = r.id;
            this.loadGraph(r.id);
          }
        },
        error: () => undefined,
      });
    this.subs.push(this.pollSub);
  }

  onRunDropdownChange(): void {
    if (!this.selectedRunId) return;
    this.loadGraph(this.selectedRunId);
  }

  loadGraph(runId: string): void {
    this.subs.push(
      this.crawler.getGraph(this.projectId, runId).subscribe({
        next: (g) => (this.graph = g),
        error: (err) => (this.errorMsg = err?.error?.message ?? 'Failed to load graph'),
      }),
    );
  }

  onNodeSelected(node: GraphNode): void {
    this.selectedNode = node;
    this.selectedNodeScreenshotUrl = null;
    if (node?.hash) {
      this.fetchScreenshot(node.hash);
    }
  }

  closeDrawer(): void {
    this.selectedNode = null;
    if (this.selectedNodeScreenshotUrl) {
      URL.revokeObjectURL(this.selectedNodeScreenshotUrl);
      this.selectedNodeScreenshotUrl = null;
    }
  }

  private fetchScreenshot(hash: string): void {
    const token = this.auth.token;
    if (!token) return;
    fetch(`${environment.apiBaseUrl}/projects/${this.projectId}/screenshots/${hash}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob) this.selectedNodeScreenshotUrl = URL.createObjectURL(blob);
      })
      .catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.pollSub?.unsubscribe();
    if (this.selectedNodeScreenshotUrl) {
      URL.revokeObjectURL(this.selectedNodeScreenshotUrl);
    }
  }
}
