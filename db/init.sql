-- Verifai local DB bootstrap (idempotent).
-- Run once as a Postgres superuser on localhost:
--     psql -U postgres -h localhost -f db/init.sql
-- Re-running is safe: existing role/database are preserved.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'verifai_app') THEN
    CREATE ROLE verifai_app WITH LOGIN PASSWORD 'verifai_app_local';
  END IF;
END
$$;

SELECT 'CREATE DATABASE verifai OWNER verifai_app'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'verifai')
\gexec

GRANT ALL PRIVILEGES ON DATABASE verifai TO verifai_app;
