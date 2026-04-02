-- AlterTable whatsapp_logs: add received_at, payload_raw, instance_name fields
-- and index on provider_message_id for deduplication lookups.

ALTER TABLE "whatsapp_logs"
  ADD COLUMN "received_at"   TIMESTAMPTZ(6),
  ADD COLUMN "payload_raw"   TEXT,
  ADD COLUMN "instance_name" VARCHAR(255);

CREATE INDEX "idx_wa_logs_provider_message_id" ON "whatsapp_logs"("provider_message_id");
