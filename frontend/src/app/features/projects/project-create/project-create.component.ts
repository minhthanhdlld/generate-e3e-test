import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectsService } from '../../../core/services/projects.service';

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './project-create.component.html',
  styleUrls: ['./project-create.component.css'],
})
export class ProjectCreateComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly projects = inject(ProjectsService);
  private readonly router = inject(Router);
  private sub?: Subscription;

  readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    url: ['', [Validators.required, Validators.pattern(HTTP_URL_PATTERN)]],
    targetUsername: ['', [Validators.required, Validators.maxLength(254)]],
    targetPassword: ['', [Validators.required, Validators.minLength(1)]],
    description: ['', [Validators.maxLength(500)]],
  });

  loading = false;
  errorMsg = '';
  showPassword = false;

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    const v = this.form.getRawValue() as {
      name: string;
      url: string;
      targetUsername: string;
      targetPassword: string;
      description: string;
    };
    this.sub = this.projects
      .create({
        name: v.name.trim(),
        url: v.url.trim(),
        targetUsername: v.targetUsername.trim(),
        targetPassword: v.targetPassword,
        description: v.description?.trim() || undefined,
      })
      .subscribe({
        next: (p) => void this.router.navigate(['/projects', p.id]),
        error: (err) => {
          const msg = err?.error?.message;
          this.errorMsg = Array.isArray(msg)
            ? msg.join(' ')
            : msg ?? 'Failed to create project';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
