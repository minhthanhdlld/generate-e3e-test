import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../../core/services/projects.service';
import { Project } from '../../../core/models/project.model';
import { StatusPillComponent } from '../../../layout/shared/status-pill/status-pill.component';
import { GeneralInfoTabComponent } from './tabs/general-info-tab/general-info-tab.component';
import { GraphUiTabComponent } from './tabs/graph-ui-tab/graph-ui-tab.component';
import { TestCasesTabComponent } from './tabs/test-cases-tab/test-cases-tab.component';

type Tab = 'general' | 'graph' | 'test-cases';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    StatusPillComponent,
    GeneralInfoTabComponent,
    GraphUiTabComponent,
    TestCasesTabComponent,
  ],
  templateUrl: './project-detail.component.html',
  styleUrls: ['./project-detail.component.css'],
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsApi = inject(ProjectsService);
  private subs: Subscription[] = [];

  project: Project | null = null;
  loading = true;
  errorMsg = '';

  activeTab: Tab = 'general';

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.errorMsg = 'Missing project id';
      this.loading = false;
      return;
    }
    const fragment = this.route.snapshot.fragment;
    if (fragment === 'graph' || fragment === 'test-cases') this.activeTab = fragment;

    this.subs.push(
      this.projectsApi.findOne(idParam).subscribe({
        next: (p) => {
          this.project = p;
          this.loading = false;
        },
        error: (err) => {
          this.errorMsg = err?.error?.message ?? 'Could not load project';
          this.loading = false;
        },
      }),
    );
  }

  setTab(t: Tab): void {
    this.activeTab = t;
    if (this.project) {
      void this.router.navigate([], {
        relativeTo: this.route,
        fragment: t === 'general' ? undefined : t,
        replaceUrl: true,
      });
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
