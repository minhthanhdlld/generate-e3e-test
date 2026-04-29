# Detailed Requirements — Verifai Project (Phase-by-Phase)

## Context
Build a **local-only** web application that lets a registered user create a "Project" by providing a target website's URL + credentials, then for each project: (a) display general information, (b) automatically crawl the site and render a UI graph/map of its pages and elements, and (c) generate an automation test-case prompt from the project's general information. The reference UI lives in [features/](features/) (Angular standalone components, TailwindCSS, brand name **Verifai**) and must be reused/extended rather than redesigned.

**Tech Stack (fixed)**
- Frontend: Angular (standalone components, signals) + TailwindCSS
- Backend: NestJS + TypeORM + PostgreSQL
- Database admin: pgAdmin4
- Crawler runtime: Node.js (Playwright-based `crawl.ts` per project)
- Deployment: local server only — services run as native processes on the host (no containers, no cloud, no CI/CD)

---

## Phase 0 — Project Setup & Infrastructure

**Goal:** A runnable monorepo skeleton with frontend, backend, and database talking to each other on localhost.

**Deliverables**
- Repo layout
  - `frontend/` — Angular workspace (latest stable), TailwindCSS configured, `environment.ts` pointing to `http://localhost:3000/api`.
  - `backend/` — NestJS workspace, TypeORM module bootstrapped, `.env` for DB/JWT/crawler config.
  - `db/` — SQL init scripts and pgAdmin4 server-export file (optional).
- Local services
  - PostgreSQL installed natively on the host (e.g. Postgres.app on macOS or the official installer) and running on `localhost:5432`. Database name: `verifai`. Default user `verifai_app`.
  - pgAdmin4 installed natively, with a saved server profile pointing at the above DB.
- Tooling
  - ESLint + Prettier on both apps.
  - `npm run dev` (concurrently) at repo root starts backend + frontend.
- Reuse from [features/](features/)
  - Move existing standalone components into `frontend/src/app/features/` preserving paths: [auth/login/login.component.ts](features/auth/login/login.component.ts), [auth/register/register.component.ts](features/auth/register/register.component.ts), [dashboard/dashboard.component.ts](features/dashboard/dashboard.component.ts), [users/users.component.ts](features/users/users.component.ts), [test-manager/test-manager.component.ts](features/test-manager/test-manager.component.ts).
  - Create the missing shared scaffolding referenced by them: `core/services/auth.service.ts`, `environments/environment.ts`, app routing, app shell layout (sidebar + topbar consistent with the dashboard look).

**Acceptance**
- `npm run dev` boots both apps; navigating to `http://localhost:4200` renders the login page; backend health check `GET /api/health` returns `{ status: 'ok' }`.

---

## Phase 1 — Database Schema & Backend Foundation

**Goal:** TypeORM entities, migrations, and shared backend modules in place.

**Entities (TypeORM)**
- `User` — `id (uuid, pk)`, `email (unique)`, `passwordHash`, `displayName`, `createdAt`, `updatedAt`.
- `Project` — `id (uuid, pk)`, `ownerId (fk → User)`, `name`, `url`, `targetUsername`, `targetPasswordEncrypted`, `description?`, `status (enum: created|crawling|crawled|failed)`, `createdAt`, `updatedAt`.
- `CrawlRun` — `id`, `projectId (fk)`, `status (queued|running|success|failed)`, `startedAt`, `finishedAt?`, `errorMessage?`, `scriptPath` (path to generated `crawl.ts`), `rawDataPath` (path to raw JSON output).
- `UiNode` — `id`, `projectId (fk)`, `crawlRunId (fk)`, `url`, `title`, `parentNodeId?`, `metadata (jsonb)` (forms/buttons/links collected).
- `UiEdge` — `id`, `crawlRunId (fk)`, `fromNodeId`, `toNodeId`, `triggerLabel` (e.g. "Click 'Login'"), `metadata (jsonb)`.
- `GeneratedTestCasePrompt` — `id`, `projectId (fk)`, `promptText (text)`, `generatedResult (text)`, `createdAt`. Result is "reused only within this section" per spec — single latest record per project surfaced in UI.

**Backend modules**
- `AuthModule`, `UsersModule`, `ProjectsModule`, `CrawlerModule`, `UiGraphModule`, `TestCaseModule`, `CommonModule` (DTO base, exception filters, response interceptor).
- Encryption utility for `targetPassword` using AES-256-GCM with key from `.env` (`PROJECT_SECRET_KEY`). Never return decrypted password to the frontend.

**Acceptance**
- `npm run typeorm migration:run` creates all tables in `verifai` DB; pgAdmin4 shows them.
- Empty CRUD scaffolds compile and `GET /api/projects` returns `401` (auth guard wired).

---

## Phase 2 — Authentication (Register / Login / Logoff)

**Goal:** A user can register, log in, and log off; protected routes are gated.

**Backend**
- `POST /api/auth/register` — body `{ email, password, displayName }`. Hash password with bcrypt (12 rounds). Returns `{ user, accessToken }`.
- `POST /api/auth/login` — body `{ username (email), password }`. Returns JWT (`HS256`, 12h TTL). A single access token is acceptable for local-only.
- `POST /api/auth/logout` — invalidates the token client-side; backend may maintain an in-memory blacklist for the session (optional given local-only).
- `GET /api/auth/me` — returns the current user from JWT.
- Global `JwtAuthGuard` protects everything outside `/api/auth/*` and `/api/health`.

**Frontend**
- Reuse [auth/login/login.component.ts](features/auth/login/login.component.ts) and [auth/register/register.component.ts](features/auth/register/register.component.ts) verbatim where possible.
- Implement `core/services/auth.service.ts` with `login()`, `register()`, `logout()`, `currentUser$` (signal), `token` persisted in `localStorage`.
- HTTP interceptor that attaches `Authorization: Bearer <token>` and on `401` redirects to `/login`.
- `authGuard` (functional Angular guard) on `/dashboard`, `/projects/**`.
- Logoff button in the app shell (top-right user menu) that calls `auth.logout()` and routes to `/login`.

**Acceptance**
- A new user can register, is auto-logged-in, and lands on the dashboard. Refreshing the page keeps them logged in. Clicking "Sign out" returns them to the login page; calling a protected API afterward returns `401`.

---

## Phase 3 — Project Creation

**Goal:** Authenticated user can create a project with the required inputs.

**Backend**
- `POST /api/projects` — body validated with `class-validator`:
  - `name: string (required, 2–80 chars)`
  - `url: string (required, valid http/https URL)`
  - `targetUsername: string (required)`
  - `targetPassword: string (required)` — encrypted at rest with AES-GCM
  - `description?: string (≤ 500 chars)`
  - Owner derived from JWT.
- Returns the created `Project` (without password).
- On creation, set `status = 'created'`. **Do not** auto-trigger crawl (kept explicit per Phase 5).

**Frontend**
- New route `/projects/new` — form using Angular reactive forms, Tailwind styling consistent with the login form.
- Fields: Project name, URL, Target Username, Target Password (with show/hide toggle reused from login), Description.
- Client-side validation matching backend rules; submit button disabled while pending.
- On success → navigate to `/projects/:id`.

**Acceptance**
- Creating a project persists a row in the `projects` table; password column in DB is ciphertext (verified in pgAdmin4); the user is redirected to the new project's detail page.

---

## Phase 4 — Project List

**Goal:** Page listing all projects owned by the current user.

**Backend**
- `GET /api/projects?search=&page=&limit=` — paginated, owner-scoped, ordered by `updatedAt DESC`. Returns `{ items, total, page, limit }`.
- `DELETE /api/projects/:id` — soft-delete optional; hard delete acceptable for local.

**Frontend**
- Route `/projects` — table/grid view consistent with [dashboard.component.ts](features/dashboard/dashboard.component.ts) styling: rounded cards, slate borders, indigo accents.
- Columns: Name, URL (truncated), Status badge (uses pill styling pattern from `pillClass` in [dashboard.component.ts](features/dashboard/dashboard.component.ts)), Last updated, Actions (Open, Delete).
- Top toolbar: search input, "+ New Project" button (links to `/projects/new`).
- Empty state with CTA.

**Acceptance**
- After creating two projects, both appear in the list newest-first; search by name filters in real time; "Open" navigates to detail; "Delete" removes the project after a confirm dialog.

---

## Phase 5 — Project Detail: General Information & Graph UI

**Goal:** Tabbed project detail page with the first two sections fully functional.

### 5a. Page shell & General Information tab
- Route `/projects/:id` with three tabs: **General Information**, **Graph UI**, **Generate Test Cases**.
- Backend `GET /api/projects/:id` returns the full project (no password).
- General Information tab displays: name, description, URL (clickable, opens in new tab), target username, status badge, created/updated timestamps, owner. Edit button → `/projects/:id/edit` (reuses Phase 3 form pre-filled; password is optional on update).

### 5b. Graph UI — Automated Crawl Pipeline

**Backend `CrawlerModule`**
- `POST /api/projects/:id/crawl` — kicks off a crawl. Flow:
  1. Create a `CrawlRun` row with `status='queued'`.
  2. **Validate URL** (HEAD request, follow redirects, ensure 2xx/3xx).
  3. **Generate `crawl.ts`** by rendering a Handlebars/EJS template into `storage/projects/<projectId>/crawl-<runId>.ts`. The script:
     - Uses Playwright (Chromium, headless).
     - Logs in via the provided URL/username/password (heuristic: find `input[type=email|text][name*=user|email]` and `input[type=password]`, click the closest submit).
     - BFS-crawls same-origin links up to depth 3 / max 50 pages (configurable via `.env`).
     - For each visited page captures: final URL, `<title>`, list of forms (action, method, input names), buttons (text), anchors (href + text), screenshot path.
     - Writes raw JSON to `storage/projects/<projectId>/raw-<runId>.json`.
  4. **Execute** the generated script via `child_process.spawn('node', ['-r', 'ts-node/register', scriptPath])`. Stream stdout/stderr to a log file, update `CrawlRun.status` on exit.
  5. **Transform** raw JSON into `UiNode` + `UiEdge` rows (one node per unique URL; edge per discovered navigation trigger).
  6. Update `Project.status` to `crawled` or `failed`.
- `GET /api/projects/:id/graph?runId?` — returns `{ nodes, edges }` for the latest (or specified) successful crawl, shape compatible with vis-network / Cytoscape.js.
- `GET /api/projects/:id/crawls` — list of past runs with status + timestamps.

**Frontend Graph UI tab**
- "Run Crawl" button (disabled while a run is in-progress) and a runs dropdown to switch between historical results.
- Status panel showing current run state with a polling subscription (`interval(2000)`) until terminal.
- Graph rendering via **Cytoscape.js** (preferred — better Angular integration, Apache-2.0). Wrap in a standalone `UiGraphComponent` that takes `{ nodes, edges }` as input. Styling: indigo nodes for entry pages, slate for internal, rose for failed-to-load; edge labels show trigger.
- Side drawer: clicking a node shows captured metadata (forms, buttons, screenshot thumbnail).

**Acceptance**
- For a project pointing at a simple local test site (e.g. a sample login + 3 pages), clicking "Run Crawl" produces a `crawl.ts` file on disk, executes it, and within ≤ 60 s renders an interactive graph with all reachable pages and labeled navigation edges. A re-run creates a new `CrawlRun` without losing the previous one.

---

## Phase 6 — Project Detail: Generate Test Case Automation

**Goal:** Within the third tab, generate a test-case prompt **from the project's general information** and display the result as a string. Result is scoped to this section (not persisted into a global test-case registry beyond the dedicated table).

**Backend**
- `POST /api/projects/:id/test-cases/generate` — body `{}`. Logic:
  1. Load project's general information (name, url, description, targetUsername).
  2. Compose a prompt using a fixed template, e.g.:
     ```
     You are a senior QA automation engineer. Given the following web application:
       - Name: {{name}}
       - URL: {{url}}
       - Description: {{description}}
       - Authenticated user: {{targetUsername}}
     Produce a numbered list of automated end-to-end test cases (Playwright + TypeScript)
     covering authentication, primary navigation, form validation, and one negative case
     per form. Output as a single string.
     ```
  3. The system returns the **prompt string itself** AND, if an LLM provider key is configured in `.env` (optional `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`), the generated test-case string. Without a key, only the prompt is returned (per spec — "generates a prompt … in string format").
  4. Persist into `GeneratedTestCasePrompt` (overwrite-or-append; UI shows latest).
- `GET /api/projects/:id/test-cases/latest` — returns latest `{ promptText, generatedResult }`.

**Frontend**
- Tab content: "Generate" button, large read-only `<textarea>` for the prompt, second `<textarea>` for the generated result. Copy-to-clipboard buttons on both. Loading spinner reused from the login component.
- Explicitly **does not** push results into the existing [test-manager/test-manager.component.ts](features/test-manager/test-manager.component.ts) — the spec confines reuse to this section.

**Acceptance**
- Clicking "Generate" returns within 2 s with a non-empty prompt string filled in; if an LLM key is set, the result textarea also populates; refreshing the tab shows the latest persisted value.

---

## Phase 7 — Polish, Local Run Verification, Hand-off

**Goal:** End-to-end smoke test on a fresh machine + minimal docs.

- Add a top-level `README.md` with: prerequisites (Node 20+, PostgreSQL 16+, pgAdmin4), one-command bootstrap (`npm run setup` runs migrations and seeds an admin user), and `npm run dev`.
- Verify the full happy path manually:
  1. Register → Login → land on dashboard.
  2. Create a project against a local sample site.
  3. Run crawl, see graph render.
  4. Generate test-case prompt, see string output.
  5. Logoff.
- Add minimal Jest tests for: auth service (backend), projects service, crawler URL-validation utility. No frontend testing required by spec.
- Confirm no external network calls are required at runtime aside from (a) the user-supplied target URL during crawl and (b) the optional LLM provider in Phase 6.

**Acceptance**
- A new contributor can clone the repo, run two commands (`npm run setup`, `npm run dev`), and complete the happy path within 10 minutes.

---

## Critical Files / Reuse Map

| Concern | Reuse from | Notes |
|---|---|---|
| Login UI | [features/auth/login/login.component.ts](features/auth/login/login.component.ts) | Move into `frontend/src/app/features/auth/login/`. |
| Register UI | [features/auth/register/register.component.ts](features/auth/register/register.component.ts) | Same. |
| App shell look & feel | [features/dashboard/dashboard.component.ts](features/dashboard/dashboard.component.ts) | Lift the card/pill/header patterns into shared Tailwind component classes. |
| Status badge styling | `pillClass` / `dotClass` in [dashboard.component.ts](features/dashboard/dashboard.component.ts) | Use the same colour mapping for project + crawl statuses. |
| Test-manager view | [features/test-manager/test-manager.component.ts](features/test-manager/test-manager.component.ts) | Visual reference only — Phase 6 output stays scoped to its tab. |

---

## Verification Plan (end-to-end)

1. Start the locally-installed PostgreSQL service; open pgAdmin4 and confirm the `verifai` database is reachable.
2. `npm run setup` → migrations create 6 tables (`users`, `projects`, `crawl_runs`, `ui_nodes`, `ui_edges`, `generated_test_case_prompts`).
3. `npm run dev` → frontend on `:4200`, backend on `:3000`.
4. Register `qa@local.test` / password `Passw0rd!` → JWT cookie/localStorage set.
5. Create project against `http://localhost:8080` (a local sample app you control). Verify password is ciphertext in DB.
6. Trigger crawl → confirm `storage/projects/<id>/crawl-<runId>.ts` exists, exits with 0, raw JSON written, graph renders ≥ 1 node.
7. Generate test cases → prompt textarea populated; if LLM key is configured, result textarea also populated; row appears in `generated_test_case_prompts`.
8. Logoff → `/projects` returns 401 when called directly; UI redirects to `/login`.
