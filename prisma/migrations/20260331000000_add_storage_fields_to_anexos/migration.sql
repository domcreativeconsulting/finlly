-- Migration: add storage_driver and storage_path to anexos
ALTER TABLE "anexos"
  ADD COLUMN IF NOT EXISTS "storage_driver" VARCHAR(10) NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS "storage_path"   VARCHAR(1024) NOT NULL DEFAULT '';

-- Backfill storage_path from url for existing rows
UPDATE "anexos" SET "storage_path" = "url" WHERE "storage_path" = '';
