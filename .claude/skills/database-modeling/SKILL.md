---
name: database-modeling
description: Auto-load when designing TypeORM entities, generating/editing migrations, choosing data types, planning indexes/constraints, naming tables/columns, or evaluating schema-change safety. Skip for FE-only or controller-only work.
---

# Database Modeling (PostgreSQL — Verifai house style; MySQL/Mongo notes)

Verifai is PostgreSQL-only via TypeORM. This skill covers the conventions enforced in the repo, plus brief portability notes for MySQL/MongoDB if the team ever forks.

## Core concepts

### Normalization (default to 3NF)
- **1NF:** atomic columns, no repeating groups. Use a child table instead of comma-joined IDs.
- **2NF:** non-key columns depend on the entire PK (matters when you have composite keys — Verifai mostly doesn't).
- **3NF:** non-key columns depend only on the PK. If `Project` ever needed `ownerEmail`, that's a 3NF violation — derive via join.
- Denormalize **only** for measured read-path wins (e.g. cached crawl counts on `Project`); document the trade-off in a `// denormalized: ...` comment.

### Relationships in TypeORM
```ts
@ManyToOne(() => User, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'ownerId' })
owner!: User;

@Column('uuid')
ownerId!: string;
```
Always declare both the relation **and** the explicit FK column so you can query/index by `ownerId` without loading the relation.

### Cascade rules (Verifai)
| Parent → Child | onDelete |
|---|---|
| User → Project | CASCADE |
| Project → CrawlRun | CASCADE |
| CrawlRun → UiNode, UiEdge | CASCADE |
| Project → GeneratedTestCasePrompt | CASCADE |

Deleting a user removes everything they own.

### Indexes
- B-tree by default. Add for: foreign keys, ORDER BY columns, WHERE filters, ILIKE prefix searches (`text_pattern_ops`).
- Verifai required indexes:
  - `projects (ownerId, updatedAt DESC)` — list page
  - `crawl_runs (projectId, startedAt DESC)` — runs dropdown
  - `ui_nodes UNIQUE (crawlRunId, url)` — dedupe
- Composite index columns ordered by selectivity (most selective first) when filtering by both; ordered by query usage when one is `=` and the other `RANGE`/`ORDER BY` (equality first).

### Constraints
- `NOT NULL` is the default — only nullable when there's a real "unknown" state (e.g. `CrawlRun.finishedAt`).
- `UNIQUE` for natural keys (`users.email`).
- `CHECK` constraints for narrow domains where an enum is overkill.
- Use TypeORM `type: 'enum', enum: [...]` (creates a real PostgreSQL enum type, not just a string column). Adding values later requires `ALTER TYPE ... ADD VALUE` in a migration.

### Naming conventions
- Table names: snake_case plural (`users`, `projects`, `crawl_runs`, `ui_nodes`, `ui_edges`, `generated_test_case_prompts`).
- Column names: camelCase via TypeORM default mapping (e.g. `ownerId`, `createdAt`). PG stores them lowercase unless quoted; TypeORM handles the quoting.
- FK columns end with `Id` (`ownerId`, `crawlRunId`).
- Boolean columns: `isX` / `hasX` (e.g. `isActive`).
- Timestamps: `createdAt`, `updatedAt`, plus domain ones (`startedAt`, `finishedAt`).

### Data types (PostgreSQL)
| Need | Use |
|---|---|
| Primary key | `uuid` (`@PrimaryGeneratedColumn('uuid')`) |
| Short text | `varchar(N)` with explicit limit |
| Long text | `text` (also for AES-GCM ciphertext base64) |
| JSON blob | `jsonb` (queryable, GIN-indexable) — never `json` |
| Money | `numeric(12,2)` — never `float`/`real` |
| Timestamp | `timestamptz` always — never naive `timestamp` |
| Enum | `@Column({ type: 'enum', enum: [...] })` |

## Best practices

### Migration safety
- **Generate, don't write by hand:** `npm run migration:generate -- src/migrations/<Name>` — review the diff before running.
- One logical change per migration after the initial `InitSchema`.
- Never edit a migration that has been committed/applied — write a follow-up.
- Backfills on big tables go in their own migration with batching (`UPDATE … WHERE id IN (SELECT id … LIMIT N)` loops).
- Adding a `NOT NULL` column to a non-empty table requires three migrations:
  1. Add nullable column.
  2. Backfill values.
  3. Set `NOT NULL` + drop default if you only wanted it for backfill.
- Rename safely with `ALTER TABLE … RENAME COLUMN` followed by app deploy — but a safer path is add new → dual-write → backfill → drop old.

### Money & time
- All times in UTC (`timestamptz`); convert to local in the FE.
- Never use floats for currency.

### Soft vs hard delete
Verifai uses **hard delete** (cascades clean up dependents). If soft-delete is ever needed, prefer `deletedAt timestamptz NULL` + a partial index `WHERE deletedAt IS NULL` over a `boolean isDeleted`.

## Anti-patterns
- ❌ `synchronize: true` in any environment.
- ❌ String columns for booleans (`'Y'/'N'`) or for enumerated states.
- ❌ Storing JSON in `text` instead of `jsonb`.
- ❌ Polymorphic FKs (`entityType`+`entityId`) — use proper FKs and concrete tables.
- ❌ Composite primary keys when a `uuid` would do.
- ❌ Missing index on a FK that's used in joins/filters.
- ❌ Plaintext secrets in any column. (`Project.targetPasswordEncrypted` is `text` of base64 ciphertext only.)
- ❌ `SELECT *` in TypeORM `find` calls when you only need a few columns on a hot path — use `select`.

## Concrete example — `Project` entity
```ts
@Entity('projects')
@Index(['ownerId', 'updatedAt'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column('uuid')
  ownerId!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column('varchar')
  url!: string;

  @Column('varchar')
  targetUsername!: string;

  @Column('text')
  targetPasswordEncrypted!: string;   // AES-GCM, base64(iv ‖ ct ‖ tag)

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ['created','crawling','crawled','failed'], default: 'created' })
  status!: 'created' | 'crawling' | 'crawled' | 'failed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
```

## Portability notes (only if the team ever forks)

### MySQL
- Use `CHAR(36)` or `BINARY(16)` for UUIDs (no native `uuid` type).
- `JSON` instead of `jsonb`; no GIN equivalent — index virtual generated columns instead.
- Enums exist but are inflexible; prefer a lookup table.
- `DATETIME(6)` for high-precision timestamps; remember to set `time_zone='+00:00'`.

### MongoDB
- One document per aggregate root; embed children only when they're always loaded together and bounded in size (so `Project` would embed neither `CrawlRun` nor `UiNode`).
- Use ObjectId, not UUID, for `_id`.
- Indexes are similar to PG B-tree; remember partial and TTL indexes.
- No FK constraints — enforce relationships in app code (or use Mongoose virtuals).

## Pre-flight checklist
- [ ] All required entities exist with `uuid` PK + `timestamptz` createdAt/updatedAt
- [ ] Foreign keys have explicit `*Id` columns and `onDelete` rules
- [ ] Required indexes from [prompt.txt](../../prompt.txt) lines 183, 193, 202 are present
- [ ] Migration is generated (not handwritten) and the diff is reviewed
- [ ] `psql -c "\dt"` shows all expected tables after `migration:run`
- [ ] No `synchronize: true` anywhere (`grep -r "synchronize: true" backend/src`)
- [ ] Seed is idempotent (`npm run seed:admin` twice → second run logs "already exists")
