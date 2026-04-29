# Verifai — Local Database Setup

## Prerequisites
- PostgreSQL 16+ running on `localhost:5432`.
- pgAdmin4 (optional, for browsing the DB visually).

## One-time bootstrap
From the repo root:

```bash
psql -U postgres -h localhost -f db/init.sql
```

This creates:
- Role `verifai_app` (LOGIN, password `verifai_app_local`) — local-only credential.
- Database `verifai` owned by `verifai_app`.

The script is idempotent — running it again is a no-op.

## Connectivity smoke test

```bash
psql -h localhost -U verifai_app -d verifai -c '\dt'
# Initially "Did not find any relations." — that is expected before Phase 1 migrations run.
```

## pgAdmin4 server profile

The file `pgadmin-server.json` can be imported in pgAdmin4 via:
**File → Import/Export Servers… → Import → choose `db/pgadmin-server.json`**

After import, expand "Verifai (local)" and authenticate with password `verifai_app_local`.
