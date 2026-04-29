Review the Verifai codebase for security, correctness, conventions, and Verifai-specific hard rules. Usage: `/review $ARGUMENTS`

# /review

Cross-cutting code review pass. Runs without dispatching the specialist agents — the Orchestrator (or a reviewer persona) reads the code directly.

## Arguments
- *(empty)* → review the entire repo (`backend/`, `frontend/`, `db/`).
- `frontend` → only `frontend/src/**`.
- `backend` → only `backend/src/**`.
- `security` → only the security-critical paths (auth, crypto, owner scoping, secret handling).
- A path glob (e.g. `backend/src/projects/**`) → restrict to that subtree.

## Review checklist

### A. Verifai hard rules (BLOCKERS — failing any of these stops the review)
1. `grep -rE "signal\(|computed\(|effect\(" frontend/src` returns empty.
2. `grep -rE "template:\s*[\`'\"]" frontend/src/app` returns empty.
3. `grep -rE "@apply" frontend/src` returns empty.
4. `grep -r "synchronize: true" backend/src` returns empty.
5. `grep -rn "decryptSecret(" backend/src` shows references **only** inside `crawler.service.ts` (and the util file itself).
6. No plaintext target password in any controller/service response, log statement, or error message.
7. Every protected endpoint uses `@CurrentUser()` and a `findOneOwned` repository method (no cross-owner reads).
8. `JwtAuthGuard` registered globally via `APP_GUARD`; `@Public()` only on `/api/auth/*` and `/api/health`.

### B. Security
- bcrypt cost is 12 (not lower).
- JWT signed `HS256`, TTL ≤ 12h, `JWT_SECRET` long enough (≥ 32 chars).
- `PROJECT_SECRET_KEY` is 32 bytes base64; AES-GCM IV is 12 bytes random per call; auth tag verified on decrypt.
- DTOs reject unknown properties (`forbidNonWhitelisted: true`).
- No SQL injection risk: only QueryBuilder/parameterized queries — no string-concatenated SQL.
- CORS limited to `http://localhost:4200`.

### C. Correctness
- Owner scoping in every list/detail query (`WHERE ownerId = :ownerId`).
- Crawl run state transitions are atomic (single transaction for raw → graph persistence).
- Polling subscription is unsubscribed in `ngOnDestroy`.
- Cytoscape instance destroyed in `ngOnDestroy`.
- Errors return the standard `{statusCode, errorCode, message, timestamp}` shape.

### D. Conventions
- Standalone components with `templateUrl`; reactive forms only.
- Tailwind utility classes inline in `.html`; status colors via `<app-status-pill>`.
- Backend modules vertical-sliced (`module/{controller, service, dto/, entities/}`).
- Migrations not edited after commit; new migration per change.
- All times `timestamptz`; UUID PKs everywhere.

### E. Performance & DX
- Required indexes present (`projects(ownerId,updatedAt)`, `crawl_runs(projectId,startedAt)`, `ui_nodes UNIQUE(crawlRunId,url)`).
- List endpoints paginated; no `findAll()` without `take`.
- Long-lived processes (crawler) stream stdout/stderr to a log file, not memory.
- No `console.log` debugging left in `backend/src` or `frontend/src`.

## Workflow
1. **Read** [features_tracking.md](../../features_tracking.md) — focus the review on functions marked `Completed` (those are the ones claiming to be done).
2. **Run all `grep` checks in section A.** Any non-empty result → BLOCKER, stop and report.
3. **Walk each section (B–E)** producing findings: `[BLOCKER] / [WARN] / [NIT]` with file:line and a one-line fix.
4. **Cross-check** every `Completed` function in [features_tracking.md](../../features_tracking.md) against its acceptance criteria — if a claim is unsupported, file a `[BLOCKER]` and revert the status to `Todo`.
5. **Output** a single review report:
   ```
   REVIEW SUMMARY
   - Scope: <scope>
   - Hard-rule grep: PASS/FAIL
   - Blockers: N
   - Warnings: N
   - Nits: N

   BLOCKERS
   - [BLOCKER] backend/src/projects/projects.service.ts:42 — leaks targetPasswordEncrypted in response. Fix: add @Exclude() on the entity field.
   ...

   WARNINGS / NITS
   ...
   ```

## Examples
```
/review                                  # full repo
/review security                         # only security-critical paths
/review backend/src/crawler              # only the crawler module
```
