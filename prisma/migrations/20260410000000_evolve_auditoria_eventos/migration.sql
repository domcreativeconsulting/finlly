-- Migration: 20260410000000_evolve_auditoria_eventos
-- Evolves auditoria_eventos for STORY 15.2 (Auditoria de Eventos Críticos)
-- Adds structured fields for actor type, event classification, entity correlation,
-- request correlation, and metadata. Keeps legacy `tipo` and `detalhes` columns
-- (now nullable) for backward compatibility with existing records.

-- Make `tipo` nullable (existing rows keep their values; new rows may omit it)
ALTER TABLE "auditoria_eventos"
    ALTER COLUMN "tipo" DROP NOT NULL;

-- New structured columns (all nullable for backward compatibility)
ALTER TABLE "auditoria_eventos"
    ADD COLUMN IF NOT EXISTS "actor_type"   VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "event_type"   VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "event_action" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "entity_type"  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "entity_id"    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "request_id"   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "metadata"     JSONB;

-- Indexes for new query patterns
CREATE INDEX IF NOT EXISTS "idx_auditoria_event_type"   ON "auditoria_eventos"("event_type");
CREATE INDEX IF NOT EXISTS "idx_auditoria_event_action" ON "auditoria_eventos"("event_action");
CREATE INDEX IF NOT EXISTS "idx_auditoria_entity"       ON "auditoria_eventos"("entity_type", "entity_id");
