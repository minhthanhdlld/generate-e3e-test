Bootstrap a Verifai workspace slice (frontend, backend, db, or all). Usage: `/scaffold $ARGUMENTS`

# /scaffold

Create a fresh project workspace within this repo. Verifai's only supported targets are local Angular + NestJS + PostgreSQL — generic templates like `nextjs-api` are out of scope here.

## Supported arguments
- `verifai-all` — full Phase 0 bootstrap: `db/`, `backend/` (`nest new`), `frontend/` (`ng new`), root `package.json` with `concurrently` for `npm run dev`.
- `verifai-backend` — NestJS workspace only.
- `verifai-frontend` — Angular workspace only.
- `verifai-db` — `db/init.sql`, `db/pgadmin-server.json`, `db/README.md` only.
- `verifai-sample-target` — a tiny local Express app on `:8080` (login form + 3 pages) to use as a crawl target during testing.

If `$ARGUMENTS` is empty or unrecognized, print this list and stop.

## Workflow
1. **Read** [requirements.md](../../requirements.md) (Phase 0) and [features_tracking.md](../../features_tracking.md) (Feature 1) to confirm acceptance criteria.
2. **Verify host prerequisites:**
   ```bash
   node --version    # ≥ 20
   psql --version    # PostgreSQL 16+
   pg_isready -h localhost -p 5432
   ```
   If anything is missing, stop and report — don't try to install system packages.
3. **Dispatch by argument:**
   - `verifai-db` → handoff to `database-architect` (writes `db/init.sql`, `db/README.md`, `db/pgadmin-server.json`).
   - `verifai-backend` → handoff to `backend-developer` (runs `nest new backend --skip-git --package-manager npm`, installs deps, writes `main.ts` / `app.module.ts` / `data-source.ts` / `.env.example`).
   - `verifai-frontend` → handoff to `frontend-developer` (runs `ng new frontend --standalone --routing --style=css --skip-git --package-manager=npm`, installs Tailwind, scaffolds `app.config.ts` / `app.routes.ts` / `core/` / `layout/`).
   - `verifai-all` → run `verifai-db` → `verifai-backend` → `verifai-frontend` in that order, then add a root `package.json`:
     ```json
     { "scripts": {
         "dev": "concurrently -n be,fe -c blue,green \"npm --prefix backend run start:dev\" \"npm --prefix frontend start\"",
         "setup": "npm --prefix backend run migration:run && npm --prefix backend run seed:admin"
     } }
     ```
   - `verifai-sample-target` → a single-file Express server in `sample-target/server.js` exposing `/login` + `/dashboard` + `/users` + `/settings`, with hard-coded creds `qa@local.test` / `Passw0rd!`.
4. **Verify** by running each agent's smoke test (e.g. `curl http://localhost:3000/api/health` for backend, `http://localhost:4200` for frontend).
5. **Update** [features_tracking.md](../../features_tracking.md) — flip the corresponding Feature 1 functions to `Completed`.

## Examples
```
/scaffold verifai-all              # full Phase 0 bootstrap
/scaffold verifai-backend          # only the NestJS workspace
/scaffold verifai-sample-target    # a local site to crawl during testing
```

## Output
After scaffolding, print:
- Files created (paths)
- Commands to run next (`npm run setup`, `npm run dev`)
- Any host prerequisite that's still missing
