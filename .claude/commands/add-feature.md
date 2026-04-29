Coordinate database-architect → backend-developer → frontend-developer to land a feature end-to-end. Usage: `/add-feature $ARGUMENTS`

# /add-feature

Drives a single feature from `features_tracking.md` through DB → BE → FE in order, marks each function `Completed` only after its acceptance criteria pass.

## Argument
`$ARGUMENTS` is one of:
- A feature number from [features_tracking.md](../../features_tracking.md) — e.g. `4` (= "Authentication").
- A feature slug — e.g. `authentication`, `project-management`, `crawl-pipeline`, `test-case-generator`, `graph-ui`.
- A specific function id — e.g. `4.5` (= "Login page (full-bleed)").

If `$ARGUMENTS` is empty, list all `Todo` features from [features_tracking.md](../../features_tracking.md) and stop.

## Workflow

### 1. PLAN (Orchestrator does this — no agent dispatch yet)
- Open [features_tracking.md](../../features_tracking.md), locate the feature/function.
- Open [requirements.md](../../requirements.md) and the canonical brief in [prompt.txt](../../prompt.txt) for cross-reference.
- Build a per-function task list grouped by responsible agent.
- Restate explicit, testable acceptance criteria.

### 2. DISPATCH (in order — never parallel)
For each function in the feature:
1. **Database first** — if `Implement Components` includes an entity/migration/seed, dispatch to `database-architect`. Wait for completion.
2. **Backend next** — if BE components are listed, dispatch to `backend-developer`. Provide endpoint contracts + DTO shapes.
3. **Frontend last** — if FE components are listed, dispatch to `frontend-developer` with the now-real endpoint URLs and response shapes.

### 3. VERIFY (mandatory; gating)
After every agent returns, run the per-layer smoke test:

**Database**
```bash
psql -h localhost -U verifai_app -d verifai -c "\dt"
psql -h localhost -U verifai_app -d verifai -c "SELECT id,email FROM users LIMIT 5;"
```

**Backend**
```bash
cd backend && npm run dev &
sleep 3
curl -fsS http://localhost:3000/api/health           # → {"status":"ok"}
curl -i  http://localhost:3000/api/projects          # → 401
# then a feature-specific curl using a real JWT
```

**Frontend grep gate** (must all be empty):
```bash
grep -rE "signal\(|computed\(|effect\(" frontend/src
grep -rE "template:\s*[\`'\"]"           frontend/src/app
grep -rE "@apply"                        frontend/src
```

**Browser smoke** — open `http://localhost:4200`, exercise the user story (e.g. for `4.5` log in with seed credentials and confirm dashboard renders).

### 4. BLOCK on failure
Print:
```
BLOCKED → <which acceptance item failed>
Expected: <expected>
Actual:   <actual>
Owner:    <agent>
Fix:      <minimal instruction>
```
Stop. Do not advance to the next function.

### 5. ADVANCE
When every function in the feature passes, edit [features_tracking.md](../../features_tracking.md) and flip each function's `Status: Todo` to `Status: Completed`.

## Examples
```
/add-feature 4              # entire authentication feature
/add-feature 4.5            # only "Login page (full-bleed)"
/add-feature crawl-pipeline # feature 8 by slug
```

## Output
After completion, print:
- Function ids marked `Completed`
- Files added/modified (paths)
- Any deferred work (e.g. "screenshot serving deferred — see Feature 8.7")
