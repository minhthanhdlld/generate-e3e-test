import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusValue =
  | 'created'
  | 'queued'
  | 'running'
  | 'crawling'
  | 'success'
  | 'crawled'
  | 'failed';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-pill.component.html',
  styleUrls: ['./status-pill.component.css'],
})
export class StatusPillComponent {
  @Input() status: StatusValue | string = 'created';

  get classes(): string {
    switch (this.status) {
      case 'crawled':
      case 'success':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      case 'crawling':
      case 'queued':
      case 'running':
        return 'bg-amber-50 text-amber-800 ring-amber-200';
      case 'failed':
        return 'bg-rose-50 text-rose-700 ring-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  get label(): string {
    if (!this.status) return '';
    return this.status.charAt(0).toUpperCase() + this.status.slice(1);
  }
}
