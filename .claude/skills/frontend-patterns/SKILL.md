---
name: frontend-patterns
description: Auto-load when working in `frontend/src/app/**/*.ts` or `*.html`, when creating/editing Angular components, when wiring routes/guards/interceptors, when building reactive forms, when using RxJS for HTTP/polling, or when integrating Cytoscape. Skip for pure backend or DB work.
---

# Frontend Patterns (Angular 17 / RxJS / Tailwind — Verifai house style)

This skill encodes the conventions used across the Verifai Angular workspace. It is intentionally **not generic React/Next.js advice** — Verifai is Angular-only and signal-free.

## Core concepts

### 1. Standalone components, lazy-loaded
Every component is `standalone: true` with explicit `imports: [...]`. Routes load components lazily:
```ts
{ path: 'projects', loadComponent: () =>
    import('./features/projects/project-list/project-list.component')
      .then(m => m.ProjectListComponent) }
```

### 2. RxJS state, no signals
State lives in `BehaviorSubject` exposed as a read-only `Observable`:
```ts
private readonly _currentUser$ = new BehaviorSubject<User | null>(this.loadUser());
readonly currentUser$ = this._currentUser$.asObservable();
get currentUser(): User | null { return this._currentUser$.value; }
```
Subscribe in templates with `| async`. Never call `signal()`, `computed()`, `effect()`, signal-input, or `model()`.

### 3. Templates in separate files, Tailwind inline
```ts
@Component({
  selector: 'app-foo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './foo.component.html',     // ALWAYS separate
  styleUrls: ['./foo.component.css'],      // plain CSS only, often empty
})
export class FooComponent {}
```
All Tailwind utility classes live inside the `.html`. Never `@apply` in CSS, never put Tailwind classes in TS strings.

### 4. Reactive forms with FormBuilder
```ts
form = this.fb.group({
  name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
  url: ['', [Validators.required, Validators.pattern(/^https?:\/\//)]],
});
```
Show errors only after `touched`:
```html
@if (form.controls.name.invalid && form.controls.name.touched) {
  <p class="mt-1 text-xs text-rose-600">Name is required (2–80 chars)</p>
}
```

### 5. HTTP via shared `ApiService`
Components never inject `HttpClient` directly for app endpoints. Wrap in `core/services/api.service.ts` so `apiBaseUrl`, retry, and error normalization stay in one place.

### 6. Polling with takeWhile (graph tab pattern)
```ts
this.pollSub = interval(2000).pipe(
  switchMap(() => this.api.get<CrawlRun>(`/projects/${id}/crawls/${runId}`)),
  takeWhile(r => r.status !== 'success' && r.status !== 'failed', true),
).subscribe(r => {
  this.currentRun = r;
  if (r.status === 'success') this.loadGraph(r.id);
});
```
Always store the subscription and `unsubscribe()` in `ngOnDestroy`.

### 7. Cytoscape integration
Initialize in `ngAfterViewInit` against a `@ViewChild('graphHost', {read: ElementRef})`. Container needs `min-h-[500px]`. Destroy the instance in `ngOnDestroy`. Comment `// signals-required-by: cytoscape-angular` only if you ever import a signal-based wrapper — preferred is the vanilla `cytoscape` package.

## Best practices
- Co-locate `.component.ts` / `.component.html` / `.component.css` in the same folder as the component.
- Use Angular control-flow syntax (`@if`, `@for`, `@switch`) — not `*ngIf` / `*ngFor`.
- Track-by for lists: `@for (run of runs; track run.id)`.
- Auth pages render full-bleed (no shell). All other authenticated routes render inside `ShellComponent` (sidebar + topbar + main).
- Reuse the shared `<app-status-pill [status]>` for any project/crawl status — never re-implement the color map.
- Persist tokens under `localStorage` keys `verifai.token` and `verifai.user`.

## Anti-patterns
- ❌ `signal()`, `computed()`, `effect()`, signal-input, `model()`.
- ❌ `template: \`...\`` inline templates.
- ❌ Tailwind utility classes in TS files.
- ❌ `@apply` in `.css` files.
- ❌ Template-driven forms (`ngModel` on raw inputs).
- ❌ Subscribing without unsubscribing in long-lived components.
- ❌ Re-implementing status color tables (`bg-emerald-100` etc.) outside `<app-status-pill>`.
- ❌ Hard-coding the API base URL (use `environment.apiBaseUrl`).

## Concrete login-component skeleton (reference)
```ts
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  form = this.fb.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  loading = false;
  errorMsg = '';
  showPassword = false;

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const { username, password } = this.form.getRawValue();
    this.auth.login(username!, password!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.errorMsg = err?.error?.message ?? 'Invalid credentials';
        this.loading = false;
      },
    });
  }
}
```

## Pre-flight checklist (run before reporting done)
- [ ] `grep -rE "signal\(|computed\(|effect\(" frontend/src` returns empty
- [ ] `grep -rE "template:\s*[\`'\"]" frontend/src/app` returns empty
- [ ] `grep -rE "@apply" frontend/src` returns empty
- [ ] All new components have a sibling `.component.html` file
- [ ] Every long-lived `subscribe(...)` is paired with `unsubscribe()` in `ngOnDestroy`
- [ ] Auth pages render full-bleed; all other routes render inside `ShellComponent`
- [ ] Status colors come exclusively from `<app-status-pill>`
- [ ] `npm run dev` boots without errors and the affected route renders in the browser
