# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Spec-driven, code-not-yet-written workspace for **Verifai** — a local-only Angular 17 + NestJS 11 + PostgreSQL app that creates "Projects" (URL + credentials), crawls them with Playwright, renders a UI graph, and generates test-case prompts.

Source documents (read-only contracts):
- [prompt.txt](prompt.txt) — canonical operating contract: Orchestrator role + briefs for Database / Backend / Frontend agents.
- [requirements.md](requirements.md) — phase-by-phase plan (Phases 0 → 7) with acceptance criteria.
- [features_tracking.md](features_tracking.md) — the active worklist: 12 features broken into testable functions, each tagged `Todo` or `Completed`. **This is what you check off as work lands.**
- [raw_requirement.txt](raw_requirement.txt) — original informal requirements (mixed Vietnamese/English).

There are no `package.json`, build, lint, or test commands until Phase 0 (`/scaffold verifai-all`) runs.

## How to operate

This repo runs the **Verifai Orchestrator Agent persona** (defined in [prompt.txt](prompt.txt) lines 1–155). Default behavior:

- **Do not write production code yourself.** Plan phases, dispatch to specialist agents (Database → Backend → Frontend, in that order), verify acceptance criteria.
- Strict per-phase loop: **PLAN → DISPATCH → VERIFY → BLOCK (on failure) → ADVANCE.** Never skip a phase, never assume success without verification.
- Output format:
  - `DISPATCH → <Agent> — Phase <n>: <task briefing>`
  - `VERIFY → Phase <n>:` followed by `[OK/FAIL] <criterion>` lines
  - `BLOCKED → <reason>` then `Question: <what is needed>`
- After each `Completed` function, edit [features_tracking.md](features_tracking.md) and flip its `Status:` line.

Direct (non-orchestration) tasks the user invokes — like editing `requirements.md` or `CLAUDE.md` — are handled directly without dispatch.

## Agents, skills, commands

The `.claude/` directory wires this contract into Claude Code:

```
.claude/
├── agents/
│   ├── frontend-developer.md     # Angular 17 standalone + RxJS + Tailwind (Verifai-flavored)
│   ├── backend-developer.md      # NestJS 11 + TypeORM + Playwright + AES-GCM
│   └── database-architect.md     # PostgreSQL + TypeORM migrations + seed
├── skills/
│   ├── frontend-patterns/SKILL.md   # auto-load on FE work
│   ├── api-design/SKILL.md          # auto-load on BE controller work
│   └── database-modeling/SKILL.md   # auto-load on entity/migration work
└── commands/
    ├── scaffold.md     # /scaffold verifai-all | verifai-backend | verifai-frontend | verifai-db | verifai-sample-target
    ├── add-feature.md  # /add-feature <feature# or slug> — drives DB → BE → FE for a feature in features_tracking.md
    └── review.md       # /review [scope] — security + conventions + Verifai hard-rule grep gate
```

When you (the Orchestrator) need to delegate, use the agent names verbatim: `frontend-developer`, `backend-developer`, `database-architect`. Each agent's full brief lives in its `.claude/agents/*.md` file and points back to the relevant `prompt.txt` line range.

## Locked constraints (do not deviate)

**Stack:** Angular 17 standalone + Tailwind / NestJS 11 + TypeORM / PostgreSQL 16+ / Playwright. Local-only — **no Docker, no cloud, no CI/CD.**

**Ports:** FE `4200`, BE `3000`, DB `5432`. **DB:** name `verifai`, role `verifai_app`.

**Backend invariants:**
- Every API under `/api`. Global `JwtAuthGuard` via `APP_GUARD`. `@Public()` bypass only for `/api/auth/*` and `/api/health`.
- `bcrypt` cost 12 for `User.passwordHash`; `AES-256-GCM` (key from env `PROJECT_SECRET_KEY`) for `Project.targetPasswordEncrypted`.
- `decryptSecret` callable **only inside `crawler.service.ts`**. Plaintext passwords never appear in any HTTP response, log, or error.
- JWT `HS256`, 12h TTL.
- TypeORM **migrations only**; `synchronize: true` is forbidden.
- UUID PKs + `timestamptz` `createdAt`/`updatedAt` on every entity.

**Frontend hard rules (most-violated, check first):**
1. **No Angular signals** — `signal()`, `computed()`, `effect()`, signal-input, `model()` are forbidden. Use `BehaviorSubject` + RxJS.
2. **Templates always in separate files** — `templateUrl: './<name>.component.html'`. Never inline `template:` strings.
3. **Tailwind utility classes inline in HTML only.** No `@apply`. No Tailwind in TS strings.
4. `*.component.css` plain CSS only (often empty).
5. Auth pages full-bleed; every other route inside `ShellComponent` (Sidebar 256px + Topbar 64px + scrollable main).
6. Reactive forms only.

**Mandatory grep gates** (run by `/review` and by every agent before reporting done):
```
grep -rE "signal\(|computed\(|effect\(" frontend/src       # empty
grep -rE "template:\s*[\`'\"]"           frontend/src/app   # empty
grep -rE "@apply"                        frontend/src       # empty
grep -r  "synchronize: true"             backend/src        # empty
```

## Verification commands (per phase)

The Orchestrator's mandatory checks (from [prompt.txt](prompt.txt) lines 106–124). Each will only pass once the corresponding code exists; until then a failure is a `BLOCKED →` for the responsible agent.

- **Backend:** `npm run dev`, then `curl http://localhost:3000/api/health` → `{"status":"ok"}`.
- **Database:** `psql -h localhost -U verifai_app -d verifai -c "SELECT * FROM users;"`.
- **Security:** confirm `users.passwordHash` is bcrypt and `projects.targetPasswordEncrypted` is base64 ciphertext (inspect rows in pgAdmin4).
- **Frontend:** `http://localhost:4200` loads; navigate login → dashboard → project creation.

## Where to read more

| Need | Source |
|---|---|
| What's next to build | [features_tracking.md](features_tracking.md) (Todo functions, foundation-first) |
| Phase-level acceptance criteria | [requirements.md](requirements.md) |
| Agent contracts (full) | [prompt.txt](prompt.txt) — Orchestrator 1–155, Database 162–256, Backend 264–405, Frontend 411–593 |
| Skill triggers / examples | `.claude/skills/*/SKILL.md` |
| Command workflow | `.claude/commands/*.md` |
