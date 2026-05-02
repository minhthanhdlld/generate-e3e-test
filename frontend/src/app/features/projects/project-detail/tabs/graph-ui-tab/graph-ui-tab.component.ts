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

// Soft client-side ceiling. After this elapses while a run is still in flight,
// the FE auto-issues a cancel and surfaces a "took too long" warning. The BE
// has its own hard cap (CRAWLER_MAX_DURATION_MS); this is the friendlier UX.
const SOFT_TIMEOUT_MS = 180 * 1000;

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
  private tickHandle?: ReturnType<typeof setInterval>;

  runs: CrawlRun[] = [];
  selectedRunId: string | null = null;
  currentRun: CrawlRun | null = null;
  graph: Graph | null = null;
  selectedNode: GraphNode | null = null;
  selectedNodeScreenshotUrl: string | null = null;

  // Live ticker — drives the elapsed-time UI without depending on the poll cadence.
  elapsedMs = 0;
  // Set to true when the soft 180s ceiling has been crossed; triggers the
  // warning banner + auto-cancel.
  softTimeoutFired = false;

  isStarting = false;
  isCancelling = false;
  errorMsg = '';
  warningMsg = '';

  ngOnInit(): void {
    this.refreshRuns(true);
  }

  refreshRuns(autoLoadLatest: boolean): void {
    this.subs.push(
      this.crawler.listRuns(this.projectId).subscribe({
        next: (rs) => {
          this.runs = rs;
          const inflight = rs.find(
            (r) => r.status === 'queued' || r.status === 'running',
          );
          if (inflight) {
            this.currentRun = inflight;
            this.startTicker(inflight.startedAt);
            this.startPolling(inflight.id);
          }
          if (autoLoadLatest && rs.length > 0) {
            const latestSuccess = rs.find((r) => r.status === 'success');
            if (latestSuccess) {
              this.selectedRunId = latestSuccess.id;
              this.loadGraph(latestSuccess.id);
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

  get elapsedSec(): number {
    return Math.floor(this.elapsedMs / 1000);
  }

  get softTimeoutSec(): number {
    return Math.floor(SOFT_TIMEOUT_MS / 1000);
  }

  startCrawl(): void {
    this.isStarting = true;
    this.errorMsg = '';
    this.warningMsg = '';
    this.softTimeoutFired = false;
    this.subs.push(
      this.crawler.startCrawl(this.projectId).subscribe({
        next: (res) => {
          this.isStarting = false;
          this.startTicker(res.startedAt);
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

  cancelCrawl(): void {
    if (!this.currentRun) return;
    if (!window.confirm('Cancel this crawl?')) return;
    this.cancelInternal('Cancelled by user');
  }

  /** Stops the in-flight run with the given reason. Used by both the manual
   *  Cancel button and the 180s soft-timeout watchdog. */
  private cancelInternal(reason: string): void {
    if (!this.currentRun) return;
    this.isCancelling = true;
    this.subs.push(
      this.crawler.cancelRun(this.projectId, this.currentRun.id).subscribe({
        next: (r) => {
          this.isCancelling = false;
          this.currentRun = r;
          this.stopTicker();
          this.refreshRuns(false);
          if (reason !== 'Cancelled by user') {
            this.warningMsg = reason;
          }
        },
        error: (err) => {
          this.isCancelling = false;
          this.errorMsg = err?.error?.message ?? 'Failed to cancel crawl';
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
          if (r.status === 'success' || r.status === 'failed') {
            this.stopTicker();
            if (r.status === 'success') {
              this.selectedRunId = r.id;
              this.loadGraph(r.id);
            } else if (r.errorMessage) {
              // Surface the failure reason (e.g. "Crawl timed out after 300s")
              this.errorMsg = r.errorMessage;
            }
            this.refreshRuns(false);
          }
        },
        error: () => undefined,
      });
    this.subs.push(this.pollSub);
  }

  private startTicker(startedAt: string | Date): void {
    this.stopTicker();
    const start = new Date(startedAt).getTime();
    this.elapsedMs = Math.max(0, Date.now() - start);
    this.tickHandle = setInterval(() => {
      this.elapsedMs = Math.max(0, Date.now() - start);
      // Soft watchdog: at 180s, surface a warning and auto-cancel the run so
      // the user isn't left waiting on a hung target.
      if (
        !this.softTimeoutFired &&
        this.elapsedMs >= SOFT_TIMEOUT_MS &&
        this.currentRun &&
        (this.currentRun.status === 'queued' || this.currentRun.status === 'running')
      ) {
        this.softTimeoutFired = true;
        this.cancelInternal(
          `Crawl took too long (over ${this.softTimeoutSec}s) — automatically cancelled.`,
        );
      }
    }, 500);
  }

  private stopTicker(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = undefined;
    }
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
    this.stopTicker();
    if (this.selectedNodeScreenshotUrl) {
      URL.revokeObjectURL(this.selectedNodeScreenshotUrl);
    }
  }
}
