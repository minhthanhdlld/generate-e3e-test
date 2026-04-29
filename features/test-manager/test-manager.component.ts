import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';
import { TestCase, TestCaseStatus } from '../../core/models/test-case.model';
import { environment } from '../../../environments/environment';

const STATUS_PILL: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  RUNNING: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  PASSED:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  FAILED:  'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  SKIPPED: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};
const PRIORITY_CLR: Record<string, string> = {
  Critical: 'text-rose-600', High: 'text-orange-600', Medium: 'text-sky-600', Low: 'text-slate-500',
};

@Component({
  selector: 'app-test-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <!-- Breadcrumb + title -->
      <div>
        <nav class="text-sm text-slate-500 flex items-center gap-1.5">
          <a class="hover:text-slate-700 cursor-pointer">Projects</a>
          <span class="text-slate-300">/</span>
          <span class="text-slate-700 font-medium">Verifai</span>
        </nav>
      </div>

      <!-- Tabs -->
      <div class="border-b border-slate-200">
        <nav class="flex gap-1 -mb-px overflow-x-auto">
          @for (tab of tabs; track tab.id) {
            <button (click)="activeTab.set(tab.id)"
              class="px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition inline-flex items-center gap-1.5"
              [class]="activeTab() === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'">
              <span [innerHTML]="tab.icon" class="w-4 h-4 inline-flex"></span>
              {{ tab.label }}
            </button>
          }
        </nav>
      </div>

      <!-- Header -->
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">AI-Generated Tests</h1>
          <p class="text-sm text-slate-500 mt-0.5">Review, approve, and manage AI-generated test cases from your project knowledge.</p>
        </div>
        <button class="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white inline-flex items-center gap-1.5">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.09 6.26L20 9l-5 4.87L16.18 21 12 17.77 7.82 21 9 13.87 4 9l5.91-.74L12 2z"/></svg>
          Generate Tests
        </button>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button (click)="statusFilter.set('all')"
          class="text-left rounded-xl border bg-white p-4 transition"
          [class]="statusFilter() === 'all' ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'">
          <div class="text-2xl font-semibold text-slate-900">{{ total() }}</div>
          <div class="text-xs text-slate-500 mt-0.5">Total</div>
        </button>
        <button (click)="statusFilter.set('PENDING_REVIEW')"
          class="text-left rounded-xl border bg-white p-4 transition"
          [class]="statusFilter() === 'PENDING_REVIEW' ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200 hover:border-slate-300'">
          <div class="text-2xl font-semibold text-slate-900">{{ countOf('PENDING_REVIEW') }}</div>
          <div class="text-xs text-slate-500 mt-0.5">Pending Review</div>
        </button>
        <button (click)="statusFilter.set('APPROVED')"
          class="text-left rounded-xl border bg-white p-4 transition"
          [class]="statusFilter() === 'APPROVED' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'">
          <div class="text-2xl font-semibold text-slate-900">{{ countOf('APPROVED') }}</div>
          <div class="text-xs text-slate-500 mt-0.5">Approved</div>
        </button>
        <button (click)="statusFilter.set('REJECTED')"
          class="text-left rounded-xl border bg-white p-4 transition"
          [class]="statusFilter() === 'REJECTED' ? 'border-rose-500 ring-2 ring-rose-100' : 'border-slate-200 hover:border-slate-300'">
          <div class="text-2xl font-semibold text-slate-900">{{ countOf('REJECTED') }}</div>
          <div class="text-xs text-slate-500 mt-0.5">Rejected</div>
        </button>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-64 max-w-sm">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input [(ngModel)]="searchText" (input)="onSearch()" placeholder="Search tests..."
            class="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"/>
        </div>
        <select [(ngModel)]="statusText" class="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
          <option>All Statuses</option><option>Pending</option><option>Approved</option><option>Rejected</option>
        </select>
        @if (selection.hasValue()) {
          <div class="flex items-center gap-2 ml-auto">
            <span class="text-sm text-slate-500">{{ selection.selected.length }} selected</span>
            <button (click)="runSelected()" class="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
              <svg class="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Run
            </button>
            <button (click)="deleteSelected()" class="h-9 px-3 rounded-lg border border-rose-200 bg-white text-sm font-medium text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Delete
            </button>
          </div>
        } @else {
          <button (click)="exportExcel()" [disabled]="tests().length === 0"
            class="ml-auto h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1.5">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Excel
          </button>
        }
      </div>

      <!-- Loading skeleton -->
      @if (loading()) {
        <div class="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="animate-pulse flex items-center gap-4 px-4 py-3.5">
              <div class="h-4 w-4 bg-slate-200 rounded"></div>
              <div class="h-4 bg-slate-200 rounded flex-1"></div>
              <div class="h-4 w-20 bg-slate-200 rounded"></div>
              <div class="h-6 w-20 bg-slate-200 rounded-full"></div>
            </div>
          }
        </div>
      }

      <!-- Empty -->
      @if (!loading() && tests().length === 0) {
        <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-16 flex flex-col items-center gap-3 text-slate-400">
          <div class="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center">
            <svg class="w-7 h-7 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2v6l-3 3v11h12V11l-3-3V2"/></svg>
          </div>
          <p class="text-base font-medium text-slate-600">No test cases yet</p>
          <p class="text-sm text-slate-400">Generate tests from your project knowledge to get started.</p>
        </div>
      }

      <!-- Table -->
      @if (!loading() && tests().length > 0) {
        <div class="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th class="px-4 py-3 text-left w-10">
                    <input type="checkbox" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      [checked]="isAllSelected()" (change)="toggleAll($event)"/>
                  </th>
                  <th class="px-4 py-3 text-left font-medium">Title</th>
                  <th class="px-4 py-3 text-left font-medium">Priority</th>
                  <th class="px-4 py-3 text-left font-medium">Confidence</th>
                  <th class="px-4 py-3 text-left font-medium">Steps</th>
                  <th class="px-4 py-3 text-left font-medium">Status</th>
                  <th class="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (t of tests(); track t.id) {
                  <tr class="hover:bg-slate-50/70 transition">
                    <td class="px-4 py-3.5">
                      <input type="checkbox" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        [checked]="selection.isSelected(t)" (change)="selection.toggle(t)"/>
                    </td>
                    <td class="px-4 py-3.5 max-w-sm">
                      <button (click)="openReview(t)" class="text-left w-full group">
                        <div class="font-medium text-slate-900 group-hover:text-indigo-600 truncate">{{ t.title }}</div>
                        <div class="text-xs text-slate-500 mt-0.5 truncate">{{ t.description || '—' }}</div>
                      </button>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="text-sm font-medium" [class]="priorityClr(t.priority)">{{ t.priority }}</span>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="text-slate-700 font-medium">{{ t.confidence }}%</span>
                    </td>
                    <td class="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {{ t.steps?.length || 0 }} steps / {{ t.blocks || 0 }} blocks
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1" [class]="statusPill(t.status)">
                        <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {{ statusLabel(t.status) }}
                      </span>
                    </td>
                    <td class="px-4 py-3.5">
                      <button class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-600">
            <div class="flex items-center gap-2">
              <span>Rows per page</span>
              <select [(ngModel)]="limit" (change)="load()" class="h-7 rounded border border-slate-300 text-xs">
                <option [ngValue]="10">10</option><option [ngValue]="25">25</option><option [ngValue]="50">50</option>
              </select>
            </div>
            <div class="flex items-center gap-3">
              <span>{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, total()) }} of {{ total() }}</span>
              <div class="flex items-center gap-1">
                <button class="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40" [disabled]="page === 1" (click)="page = page - 1; load()"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                <button class="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40" [disabled]="page * limit >= total()" (click)="page = page + 1; load()"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
            </div>
          </div>
        </div>
      }

      @if (isPolling) {
        <div class="flex items-center gap-2 text-xs text-sky-600">
          <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity=".25"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          Auto-refreshing — tests are running...
        </div>
      }
    </div>
  `,
})
export class TestManagerComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  Math = Math;

  tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>' },
    { id: 'overview', label: 'Overview', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>' },
    { id: 'envs', label: 'Environments', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' },
    { id: 'suites', label: 'Test Suites', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' },
    { id: 'plans', label: 'Test Plans', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
    { id: 'runs', label: 'Run History', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>' },
    { id: 'vars', label: 'Variables', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6M12 19h8"/></svg>' },
    { id: 'repo', label: 'Repositories', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
    { id: 'know', label: 'Knowledge', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6m-6-4h6m-7-9l7 7"/><circle cx="12" cy="7" r="4"/></svg>' },
    { id: 'ai', label: 'AI Tests', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2 6 6 .9-4.5 4.2 1 6.4L12 16.5 7.5 19.5l1-6.4L4 8.9 10 8z"/></svg>' },
    { id: 'flow', label: 'Flow Maps', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 12l10-7M7 12l10 7"/></svg>' },
  ];

  activeTab = signal('ai');
  statusFilter = signal<string>('all');
  statusText = 'All Statuses';
  tests = signal<TestCase[]>(MOCK_TESTS);
  total = signal(70);
  loading = signal(false);
  page = 1;
  limit = 10;
  searchText = '';
  selection = new SelectionModel<TestCase>(true, []);
  isPolling = false;
  private pollSub?: Subscription;

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.pollSub?.unsubscribe(); }

  load(): void { /* fetches from ${environment.apiUrl}/test-cases */ }
  onSearch(): void { this.page = 1; this.load(); }
  countOf(s: string) { return { PENDING_REVIEW: 2, APPROVED: 14, REJECTED: 54 }[s] ?? 0; }

  statusPill(s: string) { return STATUS_PILL[s] ?? ''; }
  statusLabel(s: string) { return s === 'PENDING_REVIEW' ? 'Pending' : s.charAt(0) + s.slice(1).toLowerCase(); }
  priorityClr(p: string) { return PRIORITY_CLR[p] ?? 'text-slate-600'; }
  isAllSelected() { return this.selection.selected.length === this.tests().length; }
  toggleAll(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    checked ? this.tests().forEach(t => this.selection.select(t)) : this.selection.clear();
  }
  openReview(t: TestCase) { /* opens review modal */ }
  runSelected() {}
  deleteSelected() {}
  exportExcel() {}
}

const MOCK_TESTS: any[] = [
  { id: '1', title: 'Verify login succeeds with valid email, password, and org slug', description: 'This test verifies that a user can successfully log in by entering a...', priority: 'Critical', confidence: 95, steps: Array(11), blocks: 11, status: 'PENDING_REVIEW' },
  { id: '2', title: 'Verify login fails with valid email and org slug but wrong password', description: 'This test verifies that login fails and displays an error message when a v...', priority: 'Critical', confidence: 90, steps: Array(12), blocks: 12, status: 'PENDING_REVIEW' },
  { id: '3', title: 'Verify login form submit button is disabled when only password is filled', description: 'Navigates to the login page, fills only the password field, and verifies th...', priority: 'Medium', confidence: 78, steps: Array(5), blocks: 5, status: 'REJECTED' },
  { id: '4', title: 'Verify login with valid credentials and correct org slug redirects away from login page', description: 'Fills in valid email, password, and org slug on the login page, submits th...', priority: 'Critical', confidence: 95, steps: Array(11), blocks: 11, status: 'REJECTED' },
  { id: '5', title: 'Verify login fails with empty org slug field', description: 'Navigates to the login page, fills in valid email and password but leaves ...', priority: 'High', confidence: 83, steps: Array(8), blocks: 8, status: 'REJECTED' },
  { id: '6', title: 'Verify login fails with wrong password and user stays on login page', description: 'Fills in valid email and org slug but an incorrect password, submits the f...', priority: 'Critical', confidence: 92, steps: Array(12), blocks: 12, status: 'REJECTED' },
  { id: '7', title: 'Verify login page email field accepts input and reflects typed value', description: 'Navigates to the login page, types an email address into the email input ...', priority: 'Medium', confidence: 88, steps: Array(4), blocks: 4, status: 'REJECTED' },
  { id: '8', title: 'Verify login form submit button is disabled when only org slug is filled', description: 'Navigates to the login page, fills only the org slug field, and verifies that...', priority: 'Medium', confidence: 78, steps: Array(5), blocks: 5, status: 'REJECTED' },
];
