---
name: api-design
description: Auto-load when designing or implementing HTTP endpoints in `backend/src/**`, when writing controllers/DTOs, when defining response shapes, when handling errors, or when discussing pagination/versioning/rate limiting. Skip for FE-only or schema-only work.
---

# API Design (NestJS — Verifai house style)

Verifai's API surface is a small set of REST endpoints under `/api`. This skill captures the conventions; full endpoint catalog lives in [prompt.txt](../../prompt.txt) lines 296–375.

## Core conventions

### URL structure
- Global prefix `/api` (`app.setGlobalPrefix('api')`).
- Resource collections plural, kebab-free: `/api/projects`, `/api/test-cases`.
- Nested resources reflect ownership: `/api/projects/:id/crawls/:runId`, `/api/projects/:id/test-cases/latest`.
- No trailing slash, no `.json` extension.

### HTTP status codes
| Situation | Code |
|---|---|
| Successful read / mutation with body | 200 |
| Resource created | 201 |
| Successful mutation, no body (e.g. logout, delete) | 204 |
| Validation failure (`class-validator`) | 400 |
| Missing/invalid JWT, blacklisted token | 401 |
| Authenticated user lacks ownership (treat as 404 to avoid enumeration) | 404 |
| Owner-scoped resource not found | 404 |
| Conflicting state (e.g. crawl already running) | 409 |
| URL validator rejects target with 4xx/5xx | 422 |
| Unexpected | 500 |

### Standard error body
Global `HttpExceptionFilter` returns:
```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_FAILED",
  "message": ["name must be 2–80 characters"],
  "timestamp": "2026-04-26T10:21:00.000Z"
}
```
`message` may be a string or string[] (when class-validator returns multiple).

### Auth model
- Global `JwtAuthGuard` via `APP_GUARD`. Bypass with `@Public()` on `/api/auth/*` and `/api/health`.
- Bearer token: `Authorization: Bearer <jwt>`. JWT carries `sub` (userId), `email`, `jti`.
- Logout adds `jti` to in-memory blacklist; `JwtStrategy` rejects blacklisted tokens.
- Owner identity comes from `@CurrentUser()` decorator (resolves `req.user`).

### Validation
Every request body has a DTO with `class-validator`:
```ts
export class CreateProjectDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsUrl({ protocols: ['http','https'], require_protocol: true }) url!: string;
  @IsString() @MinLength(1) targetUsername!: string;
  @IsString() @MinLength(1) targetPassword!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
```
Global pipe: `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.

### Pagination
List endpoints accept `?page=1&limit=20&search=`:
```ts
{ items: T[], total: number, page: number, limit: number }
```
Backend builds with QueryBuilder, applies `ILIKE` for search, `orderBy('updatedAt','DESC')`, `.skip((page-1)*limit).take(limit).getManyAndCount()`.

### Versioning
None — local-only single tenant. If versioning is ever added, prefer URL prefix (`/api/v2/projects`).

### Rate limiting
Not required for local-only deployment. If added: `@nestjs/throttler` with sane per-IP defaults; exempt `/api/health`.

## Response design

### Always
- Strip secrets server-side. `Project` responses NEVER include `targetPasswordEncrypted` or any decrypted form. Use a response DTO or `@Exclude()` on the entity field.
- Return the created/updated resource on POST/PATCH (so the FE doesn't need a follow-up GET).
- Use camelCase JSON keys (Nest default).

### Never
- ❌ Return plaintext target passwords in any response, log, or error message.
- ❌ Leak whether a project belongs to another owner (404 not 403).
- ❌ Wrap successful responses in `{ success: true, data: ... }` envelopes — only error responses are wrapped.

## Concrete examples

### Project creation
```
POST /api/projects
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "Acme staging",
  "url": "https://staging.acme.test",
  "targetUsername": "qa@acme.test",
  "targetPassword": "s3cret!",
  "description": "Pre-prod environment"
}

→ 201 Created
{
  "id": "8f3c…",
  "ownerId": "…",
  "name": "Acme staging",
  "url": "https://staging.acme.test",
  "targetUsername": "qa@acme.test",
  "description": "Pre-prod environment",
  "status": "created",
  "createdAt": "…",
  "updatedAt": "…"
}
```

### Trigger crawl with conflict
```
POST /api/projects/8f3c…/crawl
→ 409 Conflict
{
  "statusCode": 409,
  "errorCode": "CRAWL_ALREADY_RUNNING",
  "message": "A crawl run is already in progress for this project",
  "timestamp": "…"
}
```

### Generate test cases
```
POST /api/projects/8f3c…/test-cases/generate
→ 200 OK
{
  "promptText": "You are a senior QA automation engineer…",
  "generatedResult": "1. Verify login succeeds with valid email…"   // or null if no LLM key
}
```

## OpenAPI
Optional. If added, mount `@nestjs/swagger` at `/api/docs` (still behind JWT). Decorate DTOs with `@ApiProperty`.

## Pre-flight checklist
- [ ] DTO with `class-validator` decorators in place
- [ ] Controller method returns the created/updated resource (no envelope on success)
- [ ] Owner scoping via `@CurrentUser()` and `findOneOwned`
- [ ] No secret fields leak (response DTO or `@Exclude()`)
- [ ] Errors mapped to the right code (404 for owner-mismatch, 409 for conflicting state, 422 for upstream validator)
- [ ] `curl` smoke test against the local backend confirms expected status + body
