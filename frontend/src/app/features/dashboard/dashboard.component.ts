import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProjectsService } from '../../core/services/projects.service';
import { User } from '../../core/models/user.model';
import { Project } from '../../core/models/project.model';

interface StatusCounts {
  created: number;
  crawling: number;
  crawled: number;
  failed: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly projectsApi = inject(ProjectsService);
  private subs: Subscription[] = [];

  user: User | null = null;
  total = 0;
  counts: StatusCounts = { created: 0, crawling: 0, crawled: 0, failed: 0 };
  recent: Project[] = [];
  loading = true;

  ngOnInit(): void {
    this.subs.push(
      this.auth.currentUser$.subscribe((u) => (this.user = u)),
    );
    this.subs.push(
      this.projectsApi.list({ page: 1, limit: 100 }).subscribe({
        next: (res) => {
          this.total = res.total;
          for (const p of res.items) {
            const k = p.status as keyof StatusCounts;
            if (this.counts[k] !== undefined) this.counts[k]++;
          }
          this.recent = res.items.slice(0, 5);
          this.loading = false;
        },
        error: () => (this.loading = false),
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
