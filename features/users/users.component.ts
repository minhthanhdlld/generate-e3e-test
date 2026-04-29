import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">Users</h1>
          <p class="text-sm text-slate-500 mt-0.5">Manage members of your organization.</p>
        </div>
        <button (click)="openCreate()" class="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white inline-flex items-center gap-1.5">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add User
        </button>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative flex-1 max-w-sm">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input [(ngModel)]="search" placeholder="Search users..."
            class="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"/>
        </div>
        <select class="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700">
          <option>All Roles</option><option>Admin</option><option>Member</option>
        </select>
      </div>

      @if (loading()) {
        <div class="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          @for (i of [1,2,3,4]; track i) {
            <div class="animate-pulse flex items-center gap-4 px-4 py-3.5">
              <div class="w-8 h-8 bg-slate-200 rounded-full"></div>
              <div class="h-4 bg-slate-200 rounded flex-1"></div>
              <div class="h-5 w-16 bg-slate-200 rounded-full"></div>
            </div>
          }
        </div>
      } @else {
        <div class="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3 text-left font-medium">User</th>
                <th class="px-4 py-3 text-left font-medium">Role</th>
                <th class="px-4 py-3 text-left font-medium">Created</th>
                <th class="px-4 py-3 text-left font-medium">Last Active</th>
                <th class="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (u of users(); track u.id) {
                <tr class="hover:bg-slate-50/70">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" [style.background-color]="avatarColor(u.username)">
                        {{ initials(u.username) }}
                      </div>
                      <div>
                        <div class="font-medium text-slate-900">{{ u.username }}</div>
                        <div class="text-xs text-slate-500">{{ u.username }}&#64;verifai.com</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium ring-1"
                      [class]="u.role?.name === 'admin' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-slate-100 text-slate-600 ring-slate-200'">
                      {{ u.role?.name }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-slate-600">{{ u.createdAt }}</td>
                  <td class="px-4 py-3 text-slate-600">{{ u.lastActive || '—' }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-0.5 justify-end">
                      <button (click)="openEdit(u)" class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="Edit">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button (click)="deleteUser(u)" class="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600" title="Delete">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-600">
            <span>Showing {{ users().length }} of {{ total() }}</span>
            <div class="flex items-center gap-1">
              <button class="px-3 py-1 rounded border border-slate-200 text-xs hover:bg-slate-50">Previous</button>
              <button class="px-3 py-1 rounded border border-slate-200 text-xs hover:bg-slate-50">Next</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class UsersComponent implements OnInit {
  private usersService = inject(UsersService);
  users = signal<any[]>(MOCK_USERS);
  total = signal(24);
  loading = signal(false);
  search = '';

  ngOnInit(): void {}

  initials(n: string) { return n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase(); }
  avatarColor(n: string) {
    const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return colors[h % colors.length];
  }
  openCreate() {}
  openEdit(u: any) {}
  deleteUser(u: any) {}
}

const MOCK_USERS = [
  { id: '1', username: 'Andy Nguyen', createdAt: 'Apr 10, 2026', lastActive: '2 min ago', role: { name: 'admin' } },
  { id: '2', username: 'Vo Van Quang', createdAt: 'Mar 22, 2026', lastActive: '1 hr ago', role: { name: 'admin' } },
  { id: '3', username: 'Pham Thanh', createdAt: 'Mar 14, 2026', lastActive: 'Yesterday', role: { name: 'member' } },
  { id: '4', username: 'Duong Anh', createdAt: 'Feb 28, 2026', lastActive: '3 days ago', role: { name: 'member' } },
  { id: '5', username: 'Nguyen Tuan', createdAt: 'Feb 11, 2026', lastActive: '1 week ago', role: { name: 'member' } },
];
