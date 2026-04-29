# Verifai — Features Tracking

Source of truth: [requirements.md](requirements.md) phase plan + [prompt.txt](prompt.txt) agent contracts.
Organisation: **one section per phase from requirements.md** (Phase 0 → Phase 7). Inside each phase, every function is one testable user story with title, description, implement components, and `Status: Todo|Completed`.

Legend for **Implement Components** (each task maps to exactly one of the three agents in [.claude/agents](.claude/agents)):
- **FE** = `frontend-developer` (Angular standalone + RxJS + Tailwind)
- **BE** = `backend-developer` (NestJS + TypeORM + Playwright + AES-GCM + LLM)
- **DB** = `database-architect` (PostgreSQL entities + migrations + seed + `db/init.sql`)

Tasks marked **(repo-root)** in BE are NestJS-adjacent root-of-repo work (e.g. `concurrently` script, root `README.md`); per the orchestrator's clarification these are owned by `backend-developer` to avoid orphans.

---

## Phase 0 — Project Setup & Infrastructure

Goal (from [requirements.md](requirements.md#phase-0--project-setup--infrastructure)): runnable monorepo skeleton with FE, BE, and PostgreSQL talking on localhost.

### 0.1 Provision local PostgreSQL role + database
- **Description:** `db/init.sql` (idempotent) creates role `verifai_app` (LOGIN, password `verifai_app_local`) and database `verifai` owned by `verifai_app`. Documented `psql -U postgres -f db/init.sql` in `db/README.md`.
- **Implement Components:**
  - DB: `db/init.sql`, `db/README.md`
- **Status:** Completed

### 0.2 pgAdmin4 server profile for `verifai`
- **Description:** Saved server profile (`db/pgadmin-server.json` or documented manual steps) so pgAdmin4 connects to `localhost:5432` / `verifai` / `verifai_app` in one click.
- **Implement Components:**
  - DB: `db/pgadmin-server.json` and a "Register server" walkthrough in `db/README.md`
- **Status:** Completed

### 0.3 Bootstrap NestJS workspace
- **Description:** `nest new backend --skip-git --package-manager npm`. Install: `@nestjs/typeorm typeorm pg @nestjs/config @nestjs/jwt passport passport-jwt @nestjs/passport bcrypt class-validator class-transformer playwright handlebars axios`. `main.ts` sets `app.setGlobalPrefix('api')`, enables CORS for `http://localhost:4200`, registers global `ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true})`, listens on `:3000`. `ConfigModule.forRoot({isGlobal:true})` and `TypeOrmModule.forRootAsync` wired to `data-source.ts`.
- **Implement Components:**
  - BE: `backend/package.json`, `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/data-source.ts`, `backend/.env.example`
- **Status:** Completed

### 0.4 Bootstrap Angular workspace with Tailwind
- **Description:** `ng new frontend --standalone --routing --style=css --skip-git --package-manager=npm`. Install Tailwind (`npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p`); `tailwind.config.js` `content: ['./src/**/*.{html,ts}']`; `src/styles.css` adds the three Tailwind directives. `environment.ts` sets `apiBaseUrl: 'http://localhost:3000/api'`. `app.component.html` is just `<router-outlet/>`.
- **Implement Components:**
  - FE: `frontend/package.json`, `frontend/tailwind.config.js`, `frontend/src/styles.css`, `frontend/src/environments/environment.ts`, `frontend/src/app/app.{component,config,routes}.ts`
- **Status:** Completed

### 0.5 Repo-root run scripts (`npm run dev`, `npm run setup`)
- **Description:** Root `package.json` with `concurrently` so `npm run dev` boots BE on `:3000` and FE on `:4200`; `npm run setup` runs `migration:run` + `seed:admin`. ESLint + Prettier configured on both apps.
- **Implement Components:**
  - BE (repo-root): root `package.json`, `.editorconfig`, `.prettierrc`
- **Status:** Completed

### 0.6 Public health check endpoint
- **Description:** `GET /api/health` returns `{ "status": "ok" }` HTTP 200, decorated `@Public()` so the global JWT guard does not protect it.
- **Implement Components:**
  - BE: `backend/src/app.controller.ts` (or `health.controller.ts`), `backend/src/common/decorators/public.decorator.ts`
- **Status:** Completed

### 0.7 Smoke verify Phase 0
- **Description:** `npm run dev` boots both apps clean; `curl http://localhost:3000/api/health` returns `{"status":"ok"}`; `http://localhost:4200` renders without error (auth pages can render skeletal at this point).
- **Implement Components:**
  - BE (repo-root): no new files — verification step run by Orchestrator before advancing
- **Status:** Completed

---

## Phase 1 — Database Schema & Backend Foundation

Goal (from [requirements.md](requirements.md#phase-1--database-schema--backend-foundation)): TypeORM entities, migrations, and shared backend modules in place.

### 1.1 Define `User` entity
- **Description:** Table `users`. Columns: `id (uuid, pk)`, `email (varchar, unique, not null)`, `passwordHash (varchar, not null)`, `displayName (varchar, not null)`, `createdAt`/`updatedAt` (`timestamptz`).
- **Implement Components:**
  - DB: `backend/src/users/entities/user.entity.ts`
- **Status:** Completed

### 1.2 Define `Project` entity
- **Description:** Table `projects`. Columns include `ownerId (uuid, fk → users.id ON DELETE CASCADE)`, `name varchar(80)`, `url varchar`, `targetUsername varchar`, `targetPasswordEncrypted text` (AES-GCM base64 ciphertext), `description varchar(500) NULL`, `status enum('created'|'crawling'|'crawled'|'failed') default 'created'`. Class-level `@Index(['ownerId','updatedAt'])`.
- **Implement Components:**
  - DB: `backend/src/projects/entities/project.entity.ts`
- **Status:** Completed

### 1.3 Define `CrawlRun` entity
- **Description:** Table `crawl_runs`. Columns: `projectId (uuid, fk CASCADE)`, `status enum('queued'|'running'|'success'|'failed')`, `startedAt timestamptz`, `finishedAt timestamptz NULL`, `errorMessage text NULL`, `scriptPath varchar`, `rawDataPath varchar`. `@Index(['projectId','startedAt'])`.
- **Implement Components:**
  - DB: `backend/src/crawler/entities/crawl-run.entity.ts`
- **Status:** Completed

### 1.4 Define `UiNode` + `UiEdge` entities
- **Description:** `ui_nodes` (`projectId`, `crawlRunId`, `url`, `title`, `parentNodeId` self-fk, `metadata jsonb`, `UNIQUE(crawlRunId,url)`). `ui_edges` (`crawlRunId`, `fromNodeId fk → ui_nodes.id`, `toNodeId fk → ui_nodes.id`, `triggerLabel varchar`, `metadata jsonb`).
- **Implement Components:**
  - DB: `backend/src/ui-graph/entities/ui-node.entity.ts`, `backend/src/ui-graph/entities/ui-edge.entity.ts`
- **Status:** Completed

### 1.5 Define `GeneratedTestCasePrompt` entity
- **Description:** Table `generated_test_case_prompts`. Columns: `id`, `projectId (fk)`, `promptText text not null`, `generatedResult text NULL`, `createdAt timestamptz`. UI surfaces only the latest record per project.
- **Implement Components:**
  - DB: `backend/src/test-cases/entities/generated-test-case-prompt.entity.ts`
- **Status:** Completed

### 1.6 Initial schema migration `InitSchema`
- **Description:** One generated migration creates all six tables, both enum types (`projects_status_enum`, `crawl_runs_status_enum`), the `(ownerId, updatedAt)` and `(projectId, startedAt)` composite indexes, and `UNIQUE(crawlRunId, url)`. `synchronize: false` everywhere.
- **Implement Components:**
  - DB: `backend/src/migrations/<ts>-InitSchema.ts`, `backend/src/data-source.ts`, `backend/package.json` (`typeorm`, `migration:generate`, `migration:run`, `migration:revert` scripts)
- **Status:** Completed

### 1.7 Idempotent admin seed (`seed:admin`)
- **Description:** `npm run seed:admin` creates `qa@local.test` / `Passw0rd!` (bcrypt 12), displayName `QA`. Re-running logs `[seed] admin already exists` and does not duplicate.
- **Implement Components:**
  - DB: `backend/src/seeds/seed-admin.ts`, `backend/package.json` (`seed:admin` script)
- **Status:** Completed

### 1.8 Cross-cutting backend primitives
- **Description:** AES-256-GCM utility (`encryptSecret` / `decryptSecret`, key from `PROJECT_SECRET_KEY`, output `base64(iv ‖ ct ‖ tag)`); global `HttpExceptionFilter` returning `{statusCode, errorCode, message, timestamp}`; `@CurrentUser()` param decorator that resolves `req.user` from JWT.
- **Implement Components:**
  - BE: `backend/src/common/utils/crypto.util.ts`, `backend/src/common/filters/http-exception.filter.ts`, `backend/src/common/decorators/current-user.decorator.ts`
- **Status:** Completed

### 1.9 Module skeletons + global JWT guard
- **Description:** Empty `AuthModule`, `UsersModule`, `ProjectsModule`, `CrawlerModule`, `UiGraphModule`, `TestCaseModule`, `CommonModule` registered in `AppModule`. Global `JwtAuthGuard` registered via `APP_GUARD`. `GET /api/projects` returns 401 (proves the guard is wired before any controller logic ships).
- **Implement Components:**
  - BE: `backend/src/<module>/<module>.module.ts` (×6), `backend/src/common/guards/jwt-auth.guard.ts`, `backend/src/app.module.ts`
- **Status:** Completed

---

## Phase 2 — Authentication (Register / Login / Logoff)

Goal (from [requirements.md](requirements.md#phase-2--authentication-register--login--logoff)): a user can register, log in, and log off; protected routes are gated.

### 2.1 `POST /api/auth/register`
- **Description:** Body `{email, password, displayName}`, validated by `RegisterDto`. Hashes password with bcrypt (cost 12), persists `User`, returns `{user, accessToken}` HTTP 201. `@Public()`.
- **Implement Components:**
  - BE: `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/dto/register.dto.ts`, `backend/src/users/users.service.ts`
- **Status:** Completed

### 2.2 `POST /api/auth/login`
- **Description:** Body `{username, password}` validated by `LoginDto`. Verifies bcrypt hash, signs JWT (HS256, 12h TTL, claims `sub|email|jti`), returns `{user, accessToken}` HTTP 200. `@Public()`.
- **Implement Components:**
  - BE: `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/dto/login.dto.ts`, `backend/src/auth/jwt.strategy.ts`
- **Status:** Completed

### 2.3 `POST /api/auth/logout` with token blacklist
- **Description:** Returns 204; adds the current `jti` to an in-memory `Set<string>` blacklist. `JwtStrategy` rejects tokens whose `jti` is on the list, so a follow-up `/me` returns 401.
- **Implement Components:**
  - BE: `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts` (blacklist), `backend/src/auth/jwt.strategy.ts` (blacklist check)
- **Status:** Completed

### 2.4 `GET /api/auth/me`
- **Description:** Returns the authenticated `{user}` via `@CurrentUser()`. Protected (no `@Public()`).
- **Implement Components:**
  - BE: `backend/src/auth/auth.controller.ts`
- **Status:** Completed

### 2.5 Login page (full-bleed)
- **Description:** `/login` renders full-screen with reactive form `{email, password}`, eye-toggle on password, error banner, "Sign in" CTA, link to register. Persists `verifai.token` + `verifai.user` and routes to `/dashboard` on success.
- **Implement Components:**
  - FE: `frontend/src/app/features/auth/login/login.component.{ts,html,css}`, `frontend/src/app/core/services/auth.service.ts`
- **Status:** Completed

### 2.6 Register page (full-bleed)
- **Description:** `/register` renders full-screen with reactive form `{email, password, displayName}`. On success auto-logs-in and routes to `/dashboard`.
- **Implement Components:**
  - FE: `frontend/src/app/features/auth/register/register.component.{ts,html,css}`
- **Status:** Completed

### 2.7 Auth guard + HTTP interceptor
- **Description:** Functional `authGuard` redirects unauthenticated users to `/login`. `authInterceptor` attaches `Authorization: Bearer <token>` and on 401 clears `localStorage` + routes to `/login`.
- **Implement Components:**
  - FE: `frontend/src/app/core/guards/auth.guard.ts`, `frontend/src/app/core/interceptors/auth.interceptor.ts`, `frontend/src/app/app.config.ts` (`provideHttpClient(withInterceptorsFromDi)`)
- **Status:** Completed

### 2.8 App shell layout (sidebar + topbar + main)
- **Description:** `ShellComponent` renders Sidebar (256px left, brand + nav: Dashboard / Projects / Users / Test Manager) + Topbar (64px, breadcrumbs + search + user menu with Sign out) + scrollable main hosting `<router-outlet>`. Sign out calls `auth.logout()` and routes to `/login`.
- **Implement Components:**
  - FE: `frontend/src/app/layout/shell/shell.component.{ts,html,css}`, `frontend/src/app/layout/sidebar/sidebar.component.{ts,html,css}`, `frontend/src/app/layout/topbar/topbar.component.{ts,html,css}`, `frontend/src/app/layout/shared/logo/logo.component.{ts,html,css}`, `frontend/src/app/app.routes.ts`
- **Status:** Completed

### 2.9 Reusable `<app-status-pill>`
- **Description:** Single component mapping status strings (`created`, `crawling|queued|running`, `crawled|success`, `failed`) to the prescribed Tailwind classes. Used by every list/detail surface.
- **Implement Components:**
  - FE: `frontend/src/app/layout/shared/status-pill/status-pill.component.{ts,html,css}`
- **Status:** Completed

---

## Phase 3 — Project Creation

Goal (from [requirements.md](requirements.md#phase-3--project-creation)): authenticated user can create a project with the required inputs.

### 3.1 `POST /api/projects`
- **Description:** Body validated by `CreateProjectDto`: `name (2–80)`, `url (http/https)`, `targetUsername`, `targetPassword`, `description?(≤500)`. Encrypts `targetPassword` with AES-GCM, sets owner from JWT, status `created`. Returns the project (no password).
- **Implement Components:**
  - BE: `backend/src/projects/projects.controller.ts`, `backend/src/projects/projects.service.ts`, `backend/src/projects/dto/create-project.dto.ts`
- **Status:** Completed

### 3.2 Project create page
- **Description:** `/projects/new` reactive form (name, url, targetUsername, targetPassword with eye toggle, description). Client-side validation matches backend rules. Submit disabled while pending. On success → `/projects/:id`.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-create/project-create.component.{ts,html,css}`, `frontend/src/app/core/services/api.service.ts`, `frontend/src/app/core/models/project.model.ts`
- **Status:** Completed

### 3.3 Verify ciphertext at rest
- **Description:** After creating one project from the FE, inspect the `projects` row in pgAdmin4 — `targetPasswordEncrypted` is base64 ciphertext, never the plaintext value submitted by the form.
- **Implement Components:**
  - BE (verification): `psql` / pgAdmin4 manual check; no new files
- **Status:** Completed

---

## Phase 4 — Project List

Goal (from [requirements.md](requirements.md#phase-4--project-list)): a page listing all projects owned by the current user.

### 4.1 `GET /api/projects` (paginated, owner-scoped, searchable)
- **Description:** Query params `search`, `page`, `limit`. QueryBuilder: `WHERE p.ownerId = :ownerId` plus `ILIKE` on name when search present, `ORDER BY p.updatedAt DESC`, `.skip((page-1)*limit).take(limit).getManyAndCount()`. Returns `{items,total,page,limit}`.
- **Implement Components:**
  - BE: `backend/src/projects/projects.controller.ts`, `backend/src/projects/projects.service.ts`, `backend/src/projects/dto/list-projects.query.dto.ts`
- **Status:** Completed

### 4.2 `GET /api/projects/:id` (owner-scoped detail)
- **Description:** `findOneOwned(id, ownerId)` returns the project (no password). 404 (not 403) when foreign-owned to avoid enumeration.
- **Implement Components:**
  - BE: `backend/src/projects/projects.controller.ts`, `backend/src/projects/projects.service.ts`
- **Status:** Completed

### 4.3 `DELETE /api/projects/:id`
- **Description:** Hard delete — cascades clean up `crawl_runs`, `ui_nodes`, `ui_edges`, `generated_test_case_prompts` via FK rules from Phase 1.
- **Implement Components:**
  - BE: `backend/src/projects/projects.controller.ts`, `backend/src/projects/projects.service.ts`
- **Status:** Completed

### 4.4 Project list page
- **Description:** `/projects` card grid (rounded slate borders, indigo accents). Card: name, truncated URL, `<app-status-pill>`, last-updated, Open + Delete (delete confirmed via `window.confirm`). Toolbar: search input filtering by name (debounced) + "+ New Project" CTA. Empty state with CTA.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-list/project-list.component.{ts,html,css}`
- **Status:** Completed

---

## Phase 5 — Project Detail: General Information & Graph UI

Goal (from [requirements.md](requirements.md#phase-5--project-detail-general-information--graph-ui)): tabbed detail page with the first two sections fully functional.

### 5a — Page shell & General Information

#### 5.1 `PATCH /api/projects/:id` (update)
- **Description:** Updates allowed fields; if `targetPassword` is present, re-encrypts; if blank/absent, leaves unchanged. Owner-scoped via `findOneOwned`.
- **Implement Components:**
  - BE: `backend/src/projects/projects.controller.ts`, `backend/src/projects/projects.service.ts`, `backend/src/projects/dto/update-project.dto.ts`
- **Status:** Completed

#### 5.2 Three-tab project detail shell
- **Description:** `/projects/:id` hosts three tabs: General Information, Graph UI, Generate Test Cases. Tailwind tab pattern (no library). Active tab persists across refresh via query param/fragment.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-detail/project-detail.component.{ts,html,css}`
- **Status:** Completed

#### 5.3 General Information tab
- **Description:** Definition list rendering name, description, clickable URL (`target=_blank`), targetUsername, status pill, created/updated timestamps, owner displayName. Edit button → `/projects/:id/edit`.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-detail/tabs/general-info-tab/general-info-tab.component.{ts,html,css}`
- **Status:** Completed

#### 5.4 Project edit page
- **Description:** `/projects/:id/edit` reuses Phase-3 form pre-filled from `GET /api/projects/:id`; targetPassword optional on update.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-edit/project-edit.component.{ts,html,css}`
- **Status:** Completed

### 5b — Graph UI: automated crawl pipeline

#### 5.5 URL validator
- **Description:** Pure function: parse, ensure http/https, `axios.head` with `maxRedirects:5` and `timeout:5000ms`, accept 2xx/3xx, throw `InvalidTargetUrlError` on 4xx/5xx or network failure.
- **Implement Components:**
  - BE: `backend/src/crawler/url-validator.ts`
- **Status:** Completed

#### 5.6 Handlebars `crawl.ts` template renderer
- **Description:** Renders a Playwright Chromium crawler script with `{url, username, password, maxDepth, maxPages, timeoutMs, outputJsonPath}` to `storage/projects/<projectId>/crawl-<runId>.ts`. Login heuristic, BFS same-origin (depth 3, max 50 pages), per-page captures (final URL, `<title>`, forms, buttons, anchors, screenshot), exit 0/1.
- **Implement Components:**
  - BE: `backend/src/crawler/template-renderer.ts`, embedded Handlebars template
- **Status:** Completed

#### 5.7 `POST /api/projects/:id/crawl`
- **Description:** Returns 409 if a queued/running run already exists. Otherwise inserts `CrawlRun{status:'queued'}` and sets `Project.status='crawling'`, validates URL, **decrypts target password (only here)**, renders + spawns the script via `child_process.spawn('node', ['-r','ts-node/register', scriptPath])` with stdout/stderr piped to `storage/projects/<projectId>/logs/run-<runId>.log`.
- **Implement Components:**
  - BE: `backend/src/crawler/crawler.controller.ts`, `backend/src/crawler/crawler.service.ts`
- **Status:** Completed

#### 5.8 Raw → graph transformation
- **Description:** On script exit 0: read raw JSON, dedupe URLs into `UiNode` rows, build `UiEdge` rows from discovered nav triggers, persist in a single transaction. Mark `CrawlRun.status='success'`, `Project.status='crawled'`. On non-zero/exception, mark `failed` with `errorMessage`.
- **Implement Components:**
  - BE: `backend/src/crawler/raw-transformer.ts`, `backend/src/crawler/crawler.service.ts`
- **Status:** Completed

#### 5.9 List + single-run crawl endpoints
- **Description:** `GET /api/projects/:id/crawls` (ordered `startedAt DESC`); `GET /api/projects/:id/crawls/:runId` (used by FE polling).
- **Implement Components:**
  - BE: `backend/src/crawler/crawler.controller.ts`, `backend/src/crawler/crawler.service.ts`
- **Status:** Completed

#### 5.10 `GET /api/projects/:id/graph?runId?`
- **Description:** Returns `{nodes, edges}` for the latest successful run (or specified). Node `kind` is `entry` (first crawled URL), `internal`, or `failed` (unreachable). Shape compatible with Cytoscape.
- **Implement Components:**
  - BE: `backend/src/ui-graph/ui-graph.controller.ts`, `backend/src/ui-graph/ui-graph.service.ts`
- **Status:** Completed

#### 5.11 Authenticated screenshot serving
- **Description:** `GET /api/projects/:id/screenshots/:hash` streams the PNG from `storage/projects/<id>/screenshots/<hash>.png` for the owner via `StreamableFile`.
- **Implement Components:**
  - BE: `backend/src/crawler/crawler.controller.ts` (or dedicated controller)
- **Status:** Completed

#### 5.12 Graph UI tab + Run Crawl button
- **Description:** Tab content: Run Crawl button (disabled while running), runs dropdown to switch historical runs, status panel.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-detail/tabs/graph-ui-tab/graph-ui-tab.component.{ts,html,css}`
- **Status:** Completed

#### 5.13 Run-status polling
- **Description:** After Run Crawl, `interval(2000)` → `switchMap` to `GET /crawls/:runId` → `takeWhile(r => r.status !== 'success' && r.status !== 'failed', true)`. Subscription stored and `unsubscribe()`d in `ngOnDestroy`. On `success` → `loadGraph(runId)`.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-detail/tabs/graph-ui-tab/graph-ui-tab.component.ts`
- **Status:** Completed

#### 5.14 Cytoscape graph component
- **Description:** `<app-ui-graph [nodes] [edges] (nodeSelected)>` initializes Cytoscape in `ngAfterViewInit`. Node colors: entry indigo-600, internal slate-600, failed rose-600. Layout `breadthfirst` rooted at entry; container `min-h-[500px]`. Instance destroyed in `ngOnDestroy`.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-detail/tabs/graph-ui-tab/ui-graph/ui-graph.component.{ts,html,css}`, dependency `cytoscape`
- **Status:** Completed

#### 5.15 Node detail drawer
- **Description:** Right-side drawer (`w-96`, slide via `translate-x` toggle) showing selected node URL, title, forms, buttons, and screenshot thumbnail. Thumbnail fetched as blob with `Authorization` header (small directive or `fetch` + `URL.createObjectURL`).
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-detail/tabs/graph-ui-tab/ui-graph-node-drawer/ui-graph-node-drawer.component.{ts,html,css}`
- **Status:** Completed

---

## Phase 6 — Project Detail: Generate Test Case Automation

Goal (from [requirements.md](requirements.md#phase-6--project-detail-generate-test-case-automation)): generate a test-case prompt from the project's general information; output is scoped to this tab.

### 6.1 Prompt builder (pure function)
- **Description:** `buildTestCasePrompt({name,url,description,targetUsername})` returns the multi-line prompt string defined in [prompt.txt](prompt.txt) lines 358–366. Unit-testable — no I/O.
- **Implement Components:**
  - BE: `backend/src/test-cases/prompt-builder.ts`, `backend/src/test-cases/prompt-builder.spec.ts`
- **Status:** Completed

### 6.2 LLM adapter (graceful fallback)
- **Description:** `llm.tryGenerate(promptText)` calls OpenAI (`gpt-4o-mini`) if `OPENAI_API_KEY`, else Anthropic (`claude-haiku-4-5`) if `ANTHROPIC_API_KEY`, else returns `null`. 30s timeout. Errors return `null` — never fails the request.
- **Implement Components:**
  - BE: `backend/src/test-cases/llm/llm.service.ts`, `backend/src/test-cases/llm/openai.client.ts`, `backend/src/test-cases/llm/anthropic.client.ts`, `backend/.env.example` keys
- **Status:** Completed

### 6.3 `POST /api/projects/:id/test-cases/generate`
- **Description:** Loads owned project, builds prompt, attempts LLM generation, persists `GeneratedTestCasePrompt`, returns `{promptText, generatedResult|null}` within 2s.
- **Implement Components:**
  - BE: `backend/src/test-cases/test-cases.controller.ts`, `backend/src/test-cases/test-cases.service.ts`
- **Status:** Completed

### 6.4 `GET /api/projects/:id/test-cases/latest`
- **Description:** Returns the most recent record for the project, or `null`.
- **Implement Components:**
  - BE: `backend/src/test-cases/test-cases.controller.ts`, `backend/src/test-cases/test-cases.service.ts`
- **Status:** Completed

### 6.5 Test-cases tab UI
- **Description:** On init: `GET .../latest` populates two readonly textareas (prompt + result). Generate button calls the generate endpoint and repopulates. Layout `grid grid-cols-1 lg:grid-cols-2 gap-4`. Each textarea has Copy button (`navigator.clipboard.writeText`) with inline confirmation. Loading spinner reused from login. Self-contained — does NOT push into Test Manager.
- **Implement Components:**
  - FE: `frontend/src/app/features/projects/project-detail/tabs/test-cases-tab/test-cases-tab.component.{ts,html,css}`
- **Status:** Completed

---

## Phase 7 — Polish, Local Run Verification, Hand-off

Goal (from [requirements.md](requirements.md#phase-7--polish-local-run-verification-hand-off)): end-to-end smoke test on a fresh machine + minimal docs.

### 7.1 Root README + bootstrap docs
- **Description:** `README.md` documents prerequisites (Node 20+, PostgreSQL 16+, pgAdmin4); explains `npm run setup` (migrations + seed) and `npm run dev`. Captures the happy-path script.
- **Implement Components:**
  - BE (repo-root): `README.md`
- **Status:** Completed

### 7.2 Dashboard landing page
- **Description:** `/dashboard` renders inside the shell with the existing card-grid look (stat cards, recent crawl runs, coverage donut). Live data optional in MVP — static placeholders acceptable; numbers can come from `GET /api/projects?limit=1` and `GET /api/projects/:id/crawls` aggregations later.
- **Implement Components:**
  - FE: `frontend/src/app/features/dashboard/dashboard.component.{ts,html,css}`
- **Status:** Completed

### 7.3 Visual-only Users page
- **Description:** `/users` route inside the shell rendering a placeholder layout. Visual reference only — no backend.
- **Implement Components:**
  - FE: `frontend/src/app/features/users/users.component.{ts,html,css}`
- **Status:** Completed

### 7.4 Visual-only Test Manager page
- **Description:** `/test-manager` route inside the shell rendering a placeholder layout. Does NOT receive output from Phase 6.
- **Implement Components:**
  - FE: `frontend/src/app/features/test-manager/test-manager.component.{ts,html,css}`
- **Status:** Completed

### 7.5 Backend unit tests for security-critical paths
- **Description:** Jest specs for `auth.service` (hash verify + JWT issue + blacklist), `projects.service` (owner scoping — user A cannot read user B), `crawler/url-validator` (accept/reject matrix), `crypto.util` (round-trip + tampered ciphertext fails).
- **Implement Components:**
  - BE: `backend/src/auth/auth.service.spec.ts`, `backend/src/projects/projects.service.spec.ts`, `backend/src/crawler/url-validator.spec.ts`, `backend/src/common/utils/crypto.util.spec.ts`
- **Status:** Completed

### 7.6 Local sample target site
- **Description:** Tiny Express app under `sample-target/` exposing `/login` + `/dashboard` + `/users` + `/settings` on `:8080` with hard-coded creds `qa@local.test` / `Passw0rd!` so the crawler has something to chew on locally.
- **Implement Components:**
  - BE (repo-root): `sample-target/server.js`, `sample-target/package.json`, `sample-target/views/*.ejs`
- **Status:** Completed

### 7.7 End-to-end happy-path smoke
- **Description:** Manual run-through on a fresh clone within 10 minutes: `npm run setup` → `npm run dev` → register → login → create project (URL `http://localhost:8080`) → run crawl → see graph render with ≥ 1 node → generate test cases → logoff. All mandated grep checks pass:
  ```
  grep -rE "signal\(|computed\(|effect\(" frontend/src       # empty
  grep -rE "template:\s*[\`'\"]"           frontend/src/app   # empty
  grep -rE "@apply"                        frontend/src       # empty
  grep -r  "synchronize: true"             backend/src        # empty
  ```
- **Implement Components:**
  - BE (repo-root) + FE + DB: verification step run by Orchestrator before declaring Phase 7 complete; no new files
- **Status:** Completed

---

## Agent coverage matrix

Every task above maps to exactly one of the three agents in [.claude/agents](.claude/agents) — there are no orphans:

| Phase | DB (`database-architect`) | BE (`backend-developer`) | FE (`frontend-developer`) |
|---|---|---|---|
| 0 | 0.1, 0.2 | 0.3, 0.5, 0.6, 0.7 | 0.4 |
| 1 | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7 | 1.8, 1.9 | — |
| 2 | — | 2.1, 2.2, 2.3, 2.4 | 2.5, 2.6, 2.7, 2.8, 2.9 |
| 3 | — | 3.1, 3.3 | 3.2 |
| 4 | — | 4.1, 4.2, 4.3 | 4.4 |
| 5a | — | 5.1 | 5.2, 5.3, 5.4 |
| 5b | — | 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11 | 5.12, 5.13, 5.14, 5.15 |
| 6 | — | 6.1, 6.2, 6.3, 6.4 | 6.5 |
| 7 | — | 7.1, 7.5, 7.6, 7.7 | 7.2, 7.3, 7.4 |

`backend-developer` explicitly owns repo-root tooling (root `package.json`, root `README.md`, `sample-target/`) and Jest specs to close the gaps surfaced in the prior coverage audit.
