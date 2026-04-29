# Verifai

Local-only **Angular 17 + NestJS 11 + PostgreSQL 16** workspace that lets a registered user create a "Project" (URL + credentials), crawl it with Playwright, render the result as a UI graph, and generate a Playwright/TypeScript test-case prompt.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | `node --version` |
| PostgreSQL | ≥ 16 | local install (e.g. `brew install postgresql@16`) on `localhost:5432` |
| pgAdmin4 | optional | only for browsing the DB visually |

PostgreSQL must be running:
```bash
brew services start postgresql@16
pg_isready -h localhost -p 5432   # → "accepting connections"
```

## One-time bootstrap

From the repo root:

```bash
# 1. Create role + database (idempotent — safe to re-run)
psql -h localhost -U "$USER" -d postgres -f db/init.sql

# 2. Install dependencies in both apps
npm install --prefix backend
npm install --prefix frontend

# 3. (BE only — required once for crawler) install Chromium
npx --prefix backend playwright install chromium

# 4. Apply migrations + seed admin
npm run setup
```

Step 4 runs `migration:run` then `seed:admin`, which creates the admin user `qa@local.test` / `Passw0rd!` (idempotent — re-running logs `[seed] admin already exists`).

## Run both apps

```bash
npm run dev
```

This boots BE on `:3000` and FE on `:4200` concurrently.

- Frontend: <http://localhost:4200>
- Backend health: <http://localhost:3000/api/health>

Sign in at `/login` with the seeded admin (or `/register` to create another account).

## Optional: a local crawl target on `:8080`

The `sample-target/` workspace is a tiny Express app (login + 4 pages) that the crawler can chew on without internet:

```bash
npm install --prefix sample-target
npm --prefix sample-target start    # http://localhost:8080
```

Login form accepts `qa@local.test` / `Passw0rd!`. In Verifai create a project pointing at `http://localhost:8080`, click **Run Crawl**, and a graph with ~5 pages appears in the Graph UI tab.

## Optional: enable LLM for test-case generation

Set either key in `backend/.env`:

```
OPENAI_API_KEY=sk-...        # uses gpt-4o-mini
ANTHROPIC_API_KEY=sk-ant-... # uses claude-haiku-4-5 (fallback)
```

Without a key, the **Generate** button on the Test Cases tab returns the prompt only and leaves `generatedResult` empty — by design.

## Mandatory grep gates

Run before declaring any phase done:

```bash
grep -rE "signal\(|computed\(|effect\(" frontend/src       # must be empty
grep -rE "template:\s*[\`'\"]"           frontend/src/app   # must be empty
grep -rE "@apply"                        frontend/src       # must be empty
grep -r  "synchronize: true"             backend/src        # must be empty
```

## Day-to-day commands

| Need | Command |
|---|---|
| Boot both apps | `npm run dev` |
| Migrate + seed | `npm run setup` |
| BE unit tests | `npm --prefix backend test` |
| BE rebuild | `npm --prefix backend run build` |
| FE rebuild | `npm --prefix frontend run build` |
| Apply new migration | `npm --prefix backend run migration:run` |
| Inspect DB | `PGPASSWORD=verifai_app_local psql -h localhost -U verifai_app -d verifai` |

## Repository structure

```
backend/      NestJS 11 + TypeORM (auth, projects, crawler, ui-graph, test-cases)
frontend/     Angular 17 standalone + Tailwind 3 (login, register, shell, project pages)
db/           init.sql (role + DB), pgadmin-server.json
sample-target/ optional local Express app on :8080 for the crawler
storage/      runtime artifacts (crawl scripts, raw JSON, screenshots, logs) — gitignored
.claude/      agents + skills + commands (orchestration metadata)
```

## License

Local-only project; no license declared.
