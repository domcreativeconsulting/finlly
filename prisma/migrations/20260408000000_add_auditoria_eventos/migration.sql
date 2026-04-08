-- Migration: 20260408000000_add_auditoria_eventos
-- Creates the auditoria_eventos table for EPIC 15 (Auditoria de Ações Críticas)

CREATE TABLE "auditoria_eventos" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id"  UUID,
    "tipo"        VARCHAR(100) NOT NULL,
    "detalhes"    JSONB,
    "ip_address"  VARCHAR(45),
    "user_agent"  VARCHAR(512),
    "sucesso"     BOOLEAN     NOT NULL DEFAULT TRUE,
    "data_evento" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "auditoria_eventos_pkey" PRIMARY KEY ("id")
);

-- Foreign key to usuarios (SetNull on delete)
ALTER TABLE "auditoria_eventos"
    ADD CONSTRAINT "fk_auditoria_usuario"
    FOREIGN KEY ("usuario_id")
    REFERENCES "usuarios"("id")
    ON DELETE SET NULL;

-- Indexes for common query patterns
CREATE INDEX "idx_auditoria_usuario" ON "auditoria_eventos"("usuario_id");
CREATE INDEX "idx_auditoria_tipo"    ON "auditoria_eventos"("tipo");
CREATE INDEX "idx_auditoria_data"    ON "auditoria_eventos"("data_evento");
