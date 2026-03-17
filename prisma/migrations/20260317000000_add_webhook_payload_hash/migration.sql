-- Migration: 04.2.2 — add payload_hash column and unique constraint to webhook_events
ALTER TABLE webhook_events
  ADD COLUMN payload_hash CHAR(64) NOT NULL DEFAULT '';

-- Backfill: compute SHA-256 of the JSON payload for existing rows.
-- Requires pgcrypto (available on Postgres 11+ when installed via CREATE EXTENSION).
-- Note: payload::text uses Postgres JSON text serialization which may differ from
-- JSON.stringify in the application. The backfill is best-effort and targets
-- dev/test rows only; production rows will always have the correct hash set by
-- the application at insert time.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE webhook_events
   SET payload_hash = encode(sha256(payload::text::bytea), 'hex');

-- Remove the temporary default (column is NOT NULL, enforced going forward by the application)
ALTER TABLE webhook_events
  ALTER COLUMN payload_hash DROP DEFAULT;

CREATE UNIQUE INDEX uq_webhook_provider_hash
  ON webhook_events (provider, payload_hash);
