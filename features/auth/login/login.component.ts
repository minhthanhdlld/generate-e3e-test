import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-md">
        <!-- Brand -->
        <div class="flex items-center gap-2 mb-8 justify-center">
          <div class="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
            </svg>
          </div>
          <span class="text-xl font-semibold text-slate-900 tracking-tight">Verifai</span>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h1 class="text-xl font-semibold text-slate-900">Sign in to your account</h1>
          <p class="text-sm text-slate-500 mt-1">Welcome back. Enter your credentials to continue.</p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="mt-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" formControlName="username" autocomplete="username"
                class="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                placeholder="you@company.com" />
              @if (form.controls.username.invalid && form.controls.username.touched) {
                <p class="mt-1 text-xs text-rose-600">Email is required</p>
              }
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="block text-sm font-medium text-slate-700">Password</label>
                <a class="text-xs text-indigo-600 hover:underline cursor-pointer">Forgot password?</a>
              </div>
              <div class="relative">
                <input [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="current-password"
                  class="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                  placeholder="Enter your password" />
                <button type="button" (click)="showPassword.set(!showPassword())"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    @if (showPassword()) {
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
                    } @else {
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    }
                  </svg>
                </button>
              </div>
              @if (form.controls.password.invalid && form.controls.password.touched) {
                <p class="mt-1 text-xs text-rose-600">Password is required</p>
              }
            </div>

            @if (errorMsg()) {
              <div class="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm">
                <svg class="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{{ errorMsg() }}</span>
              </div>
            }

            <button type="submit" [disabled]="loading()"
              class="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              @if (loading()) {
                <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity=".25"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
              }
              Sign In
            </button>

            <p class="text-center text-sm text-slate-500 pt-2">
              Don't have an account?
              <a routerLink="/register" class="text-indigo-600 font-medium hover:underline">Sign up</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  loading = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.errorMsg.set('');
    const { username, password } = this.form.value;
    this.auth.login(username!, password!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.errorMsg.set(err?.error?.message?.[0] ?? 'Invalid credentials');
        this.loading.set(false);
      },
    });
  }
}
