import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../../core/services/projects.service';

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

@Component({
  selector: 'app-project-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './project-edit.component.html',
  styleUrls: ['./project-edit.component.css'],
})
export class ProjectEditComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsApi = inject(ProjectsService);
  private readonly subs: Subscription[] = [];

  readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    url: ['', [Validators.required, Validators.pattern(HTTP_URL_PATTERN)]],
    targetUsername: ['', [Validators.required, Validators.maxLength(254)]],
    targetPassword: ['', [Validators.maxLength(256)]],
    description: ['', [Validators.maxLength(500)]],
  });

  projectId!: string;
  loading = true;
  saving = false;
  errorMsg = '';
  showPassword = false;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMsg = 'Missing project id';
      this.loading = false;
      return;
    }
    this.projectId = id;
    this.subs.push(
      this.projectsApi.findOne(id).subscribe({
        next: (p) => {
          this.form.patchValue({
            name: p.name,
            url: p.url,
            targetUsername: p.targetUsername,
            targetPassword: '',
            description: p.description ?? '',
          });
          this.loading = false;
        },
        error: (err) => {
          this.errorMsg = err?.error?.message ?? 'Could not load project';
          this.loading = false;
        },
      }),
    );
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.errorMsg = '';
    const v = this.form.getRawValue() as {
      name: string;
      url: string;
      targetUsername: string;
      targetPassword: string;
      description: string;
    };
    const payload: Record<string, string> = {
      name: v.name.trim(),
      url: v.url.trim(),
      targetUsername: v.targetUsername.trim(),
      description: v.description?.trim() ?? '',
    };
    if (v.targetPassword) payload['targetPassword'] = v.targetPassword;
    this.subs.push(
      this.projectsApi.update(this.projectId, payload).subscribe({
        next: (p) => void this.router.navigate(['/projects', p.id]),
        error: (err) => {
          const msg = err?.error?.message;
          this.errorMsg = Array.isArray(msg) ? msg.join(' ') : msg ?? 'Update failed';
          this.saving = false;
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
