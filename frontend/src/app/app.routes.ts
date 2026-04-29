import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import(
            './features/projects/project-list/project-list.component'
          ).then((m) => m.ProjectListComponent),
      },
      {
        path: 'projects/new',
        loadComponent: () =>
          import(
            './features/projects/project-create/project-create.component'
          ).then((m) => m.ProjectCreateComponent),
      },
      {
        path: 'projects/:id/edit',
        loadComponent: () =>
          import(
            './features/projects/project-edit/project-edit.component'
          ).then((m) => m.ProjectEditComponent),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import(
            './features/projects/project-detail/project-detail.component'
          ).then((m) => m.ProjectDetailComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users.component').then(
            (m) => m.UsersComponent,
          ),
      },
      {
        path: 'test-manager',
        loadComponent: () =>
          import('./features/test-manager/test-manager.component').then(
            (m) => m.TestManagerComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
