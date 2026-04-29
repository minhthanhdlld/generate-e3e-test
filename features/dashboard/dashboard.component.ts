import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface DashboardStats { totalUsers: number; totalTests: number; passed: number; failed: number; pending: number; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
          <p class="text-sm text-slate-500 mt-0.5">Overview of your testing workspace</p>
        </div>
        <div class="flex gap-2">
          <button class="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          <button class="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white inline-flex items-center gap-1.5">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Project
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (i of [1,2,3,4]; track i) {
            <div class="h-28 rounded-xl border border-slate-200 bg-white animate-pulse"></div>
          }
        </div>
      } @else {
        <!-- Stat cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Users</span>
              <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <svg class="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-3xl font-semibold text-slate-900">{{ stats().totalUsers }}</span>
              <span class="text-xs font-medium text-emerald-600">+12%</span>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Tests</span>
              <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <svg class="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2v6l-3 3v11h12V11l-3-3V2"/><line x1="9" y1="2" x2="15" y2="2"/></svg>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-3xl font-semibold text-slate-900">{{ stats().totalTests }}</span>
              <span class="text-xs font-medium text-slate-500">{{ stats().pending }} pending</span>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Passed</span>
              <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg class="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-3xl font-semibold text-slate-900">{{ stats().passed }}</span>
              <span class="text-xs font-medium text-emerald-600">{{ passRate() }}%</span>
            </div>
            <div class="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full bg-emerald-500" [style.width.%]="passRate()"></div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Failed</span>
              <div class="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <svg class="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-3xl font-semibold text-slate-900">{{ stats().failed }}</span>
              <span class="text-xs font-medium text-rose-600">Needs review</span>
            </div>
            <div class="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full bg-rose-500" [style.width.%]="failRate()"></div>
            </div>
          </div>
        </div>

        <!-- Recent activity -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-slate-900">Recent Test Runs</h2>
              <button class="text-xs font-medium text-indigo-600 hover:underline">View all</button>
            </div>
            <ul class="divide-y divide-slate-100">
              @for (run of recentRuns; track run.id) {
                <li class="px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                  <span class="w-2 h-2 rounded-full" [class]="dotClass(run.status)"></span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900 truncate">{{ run.title }}</p>
                    <p class="text-xs text-slate-500">{{ run.time }} · {{ run.duration }}</p>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium" [class]="pillClass(run.status)">{{ run.status }}</span>
                </li>
              }
            </ul>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-5">
            <h2 class="text-sm font-semibold text-slate-900">Coverage</h2>
            <p class="text-xs text-slate-500 mt-0.5">Across all projects</p>
            <div class="mt-4 flex items-center justify-center">
              <div class="relative w-32 h-32">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" stroke-width="3"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round" stroke-dasharray="78, 100"/>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-2xl font-semibold text-slate-900">78%</span>
                  <span class="text-xs text-slate-500">covered</span>
                </div>
              </div>
            </div>
            <div class="mt-4 space-y-2 text-xs">
              <div class="flex items-center justify-between"><span class="text-slate-600">Unit</span><span class="font-medium text-slate-900">92%</span></div>
              <div class="flex items-center justify-between"><span class="text-slate-600">Integration</span><span class="font-medium text-slate-900">74%</span></div>
              <div class="flex items-center justify-between"><span class="text-slate-600">E2E</span><span class="font-medium text-slate-900">68%</span></div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  loading = signal(false);
  stats = signal<DashboardStats>({ totalUsers: 24, totalTests: 342, passed: 268, failed: 18, pending: 56 });

  recentRuns = [
    { id: 1, title: 'Verify login succeeds with valid email', status: 'Passed', time: '2 min ago', duration: '1.2s' },
    { id: 2, title: 'Verify login fails with wrong password', status: 'Passed', time: '4 min ago', duration: '0.9s' },
    { id: 3, title: 'Create project flow end-to-end', status: 'Running', time: 'Just now', duration: '—' },
    { id: 4, title: 'Reset password with invalid token', status: 'Failed', time: '12 min ago', duration: '3.4s' },
    { id: 5, title: 'Invite user to organization', status: 'Passed', time: '18 min ago', duration: '1.8s' },
  ];

  passRate() { const s = this.stats(); return s.totalTests ? Math.round((s.passed / s.totalTests) * 100) : 0; }
  failRate() { const s = this.stats(); return s.totalTests ? Math.round((s.failed / s.totalTests) * 100) : 0; }

  dotClass(s: string) {
    return { Passed: 'bg-emerald-500', Failed: 'bg-rose-500', Running: 'bg-sky-500 animate-pulse' }[s] ?? 'bg-slate-400';
  }
  pillClass(s: string) {
    return {
      Passed: 'bg-emerald-50 text-emerald-700',
      Failed: 'bg-rose-50 text-rose-700',
      Running: 'bg-sky-50 text-sky-700',
    }[s] ?? 'bg-slate-100 text-slate-600';
  }

  ngOnInit(): void {
    // fetch stats from env.apiUrl (${environment.apiUrl})
  }
}
