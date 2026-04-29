import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProjectsService } from '../../../core/services/projects.service';
import { Project } from '../../../core/models/project.model';
import { StatusPillComponent } from '../../../layout/shared/status-pill/status-pill.component';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, StatusPillComponent],
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.css'],
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private readonly projectsApi = inject(ProjectsService);
  private readonly router = inject(Router);
  private readonly subs: Subscription[] = [];

  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });

  items: Project[] = [];
  total = 0;
  loading = false;
  errorMsg = '';
  deletingId: string | null = null;

  ngOnInit(): void {
    this.fetch('');
    this.subs.push(
      this.searchCtrl.valueChanges
        .pipe(debounceTime(250), distinctUntilChanged())
        .subscribe((v) => this.fetch(v ?? '')),
    );
  }

  fetch(search: string): void {
    this.loading = true;
    this.errorMsg = '';
    this.subs.push(
      this.projectsApi.list({ search }).subscribe({
        next: (res) => {
          this.items = res.items;
          this.total = res.total;
          this.loading = false;
        },
        error: (err) => {
          this.errorMsg = err?.error?.message ?? 'Failed to load projects';
          this.loading = false;
        },
      }),
    );
  }

  open(p: Project): void {
    void this.router.navigate(['/projects', p.id]);
  }

  remove(p: Project): void {
    if (!window.confirm(`Delete project "${p.name}"? This cannot be undone.`)) return;
    this.deletingId = p.id;
    this.subs.push(
      this.projectsApi.remove(p.id).subscribe({
        next: () => {
          this.items = this.items.filter((i) => i.id !== p.id);
          this.total = Math.max(0, this.total - 1);
          this.deletingId = null;
        },
        error: (err) => {
          this.errorMsg = err?.error?.message ?? 'Failed to delete project';
          this.deletingId = null;
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
