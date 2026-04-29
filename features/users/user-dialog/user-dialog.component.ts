import { Component, inject, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UsersService } from '../../../core/services/users.service';
import { User, Role } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Backdrop handled by MatDialog -->
    <div class="bg-white rounded-xl overflow-hidden w-full max-w-md">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h2 class="text-base font-semibold text-slate-900">{{ isEdit ? 'Edit User' : 'Add User' }}</h2>
          <p class="text-xs text-slate-500 mt-0.5">{{ isEdit ? 'Update account details and role.' : 'Create a new user account.' }}</p>
        </div>
        <button mat-dialog-close class="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Body -->
      <form [formGroup]="form" (ngSubmit)="submit()" class="px-6 py-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
          <input type="text" formControlName="username"
            class="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            placeholder="e.g. john.doe" />
          @if (form.controls.username.invalid && form.controls.username.touched) {
            <p class="mt-1 text-xs text-rose-600">Username is required</p>
          }
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">
            Password<span class="text-slate-400 font-normal">{{ isEdit ? ' (leave blank to keep)' : '' }}</span>
          </label>
          <input type="password" formControlName="password"
            class="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            placeholder="At least 8 characters" />
          @if (form.controls.password.invalid && form.controls.password.touched) {
            <p class="mt-1 text-xs text-rose-600">Password must be at least 8 characters</p>
          }
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
          <div class="grid grid-cols-2 gap-2">
            @for (role of roles(); track role.id) {
              <label class="flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition"
                [class]="form.value.roleId === role.id ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'">
                <input type="radio" [value]="role.id" formControlName="roleId" class="text-indigo-600"/>
                <div>
                  <div class="text-sm font-medium text-slate-900 capitalize">{{ role.name }}</div>
                  <div class="text-xs text-slate-500">{{ role.name === 'admin' ? 'Full access' : 'Limited access' }}</div>
                </div>
              </label>
            }
          </div>
        </div>
      </form>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-2 px-6 py-3 bg-slate-50/60 border-t border-slate-100">
        <button mat-dialog-close class="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        <button (click)="submit()" [disabled]="saving()"
          class="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-60">
          @if (saving()) {
            <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity=".25"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          }
          {{ isEdit ? 'Update' : 'Create' }}
        </button>
      </div>
    </div>
  `,
})
export class UserDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  private dialogRef = inject(MatDialogRef<UserDialogComponent>);

  roles = signal<Role[]>([{ id: '1', name: 'admin' } as Role, { id: '2', name: 'member' } as Role]);
  saving = signal(false);
  isEdit: boolean;

  form = this.fb.group({
    username: ['', Validators.required],
    password: [''],
    roleId: ['', Validators.required],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: User | null) {
    this.isEdit = !!data;
    if (!data) {
      this.form.controls.password.addValidators([Validators.required, Validators.minLength(8)]);
      this.form.controls.password.updateValueAndValidity();
    }
  }

  ngOnInit(): void {
    if (this.data) this.form.patchValue({ username: this.data.username, roleId: (this.data as any).roleId });
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    setTimeout(() => { this.saving.set(false); this.dialogRef.close(true); }, 500);
  }
}
