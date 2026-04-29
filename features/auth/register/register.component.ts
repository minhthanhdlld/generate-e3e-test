import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

function passwordMatch(control: AbstractControl): ValidationErrors | null {
  const p = control.get('password')?.value;
  const c = control.get('confirmPassword')?.value;
  return p && c && p !== c ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-md">
        <div class="flex items-center gap-2 mb-8 justify-center">
          <div class="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12l2 2 4-4"/></svg>
          </div>
          <span class="text-xl font-semibold text-slate-900 tracking-tight">Verifai</span>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h1 class="text-xl font-semibold text-slate-900">Create your account</h1>
          <p class="text-sm text-slate-500 mt-1">Get started with AI-powered test automation.</p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="mt-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
              <input type="text" formControlName="username" autocomplete="username"
                class="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                placeholder="Choose a username" />
              @if (form.controls.username.invalid && form.controls.username.touched) {
                <p class="mt-1 text-xs text-rose-600">
                  @if (form.controls.username.hasError('required')) { Username is required }
                  @else if (form.controls.username.hasError('minlength')) { At least 3 characters }
                  @else if (form.controls.username.hasError('maxlength')) { At most 50 characters }
                </p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div class="relative">
                <input [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="new-password"
                  class="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                  placeholder="At least 6 characters" />
                <button type="button" (click)="showPassword.set(!showPassword())"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              @if (form.controls.password.invalid && form.controls.password.touched) {
                <p class="mt-1 text-xs text-rose-600">
                  @if (form.controls.password.hasError('required')) { Password is required }
                  @else if (form.controls.password.hasError('minlength')) { At least 6 characters }
                </p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
              <input [type]="showPassword() ? 'text' : 'password'" formControlName="confirmPassword" autocomplete="new-password"
                class="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                placeholder="Re-enter password" />
              @if (form.controls.confirmPassword.touched && form.hasError('passwordMismatch')) {
                <p class="mt-1 text-xs text-rose-600">Passwords do not match</p>
              }
            </div>

            @if (errorMsg()) {
              <div class="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm">
                <span>{{ errorMsg() }}</span>
              </div>
            }

            <button type="submit" [disabled]="loading()"
              class="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2">
              @if (loading()) {
                <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity=".25"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
              }
              Create Account
            </button>

            <p class="text-center text-sm text-slate-500 pt-2">
              Already have an account?
              <a routerLink="/login" class="text-indigo-600 font-medium hover:underline">Sign in</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordMatch });

  loading = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.errorMsg.set('');
    const { username, password } = this.form.value;
    this.auth.register(username!, password!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        const msg = err?.error?.message;
        this.errorMsg.set(Array.isArray(msg) ? msg[0] : (msg ?? 'Registration failed. Please try again.'));
        this.loading.set(false);
      },
    });
  }
}
