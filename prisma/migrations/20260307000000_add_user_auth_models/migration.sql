-- =============================================================================
-- Finlly v2 — Migration: add user auth models
-- Migration: 20260307000000_add_user_auth_models
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE role_usuario AS ENUM (
  'admin',
  'user'
);

CREATE TYPE status_usuario AS ENUM (
  'ativo',
  'bloqueado_inadimplencia',
  'suspenso_seguranca'
);

-- =============================================================================
-- EXTEND: usuarios (add security/status fields)
-- =============================================================================

ALTER TABLE "usuarios"
  ADD COLUMN "role"               role_usuario    NOT NULL DEFAULT 'user',
  ADD COLUMN "status"             status_usuario  NOT NULL DEFAULT 'ativo',
  ADD COLUMN "ultima_senha_troca" TIMESTAMPTZ(6),
  ADD COLUMN "tentativas_login"   INTEGER         NOT NULL DEFAULT 0,
  ADD COLUMN "bloqueado_ate"      TIMESTAMPTZ(6);

-- =============================================================================
-- CREATE: usuario_sessoes
-- =============================================================================

CREATE TABLE "usuario_sessoes" (
  "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
  "usuario_id"         UUID          NOT NULL,
  "refresh_token_hash" VARCHAR(255)  NOT NULL,
  "device_info"        VARCHAR(512),
  "ip_address"         VARCHAR(45),
  "data_criacao"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "data_expiracao"     TIMESTAMPTZ(6) NOT NULL,
  "data_revogacao"     TIMESTAMPTZ(6),

  CONSTRAINT "usuario_sessoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_sessoes_refresh_token_hash" ON "usuario_sessoes"("refresh_token_hash");
CREATE INDEX "idx_sessoes_usuario" ON "usuario_sessoes"("usuario_id");

ALTER TABLE "usuario_sessoes"
  ADD CONSTRAINT "fk_sessoes_usuario"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE;

-- =============================================================================
-- CREATE: usuario_eventos_auth
-- =============================================================================

CREATE TABLE "usuario_eventos_auth" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "usuario_id"  UUID,
  "tipo"        VARCHAR(50)   NOT NULL,
  "sucesso"     BOOLEAN       NOT NULL,
  "erro_msg"    VARCHAR(500),
  "ip_address"  VARCHAR(45),
  "user_agent"  VARCHAR(512),
  "data_evento" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "usuario_eventos_auth_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_eventos_auth_usuario" ON "usuario_eventos_auth"("usuario_id");
CREATE INDEX "idx_eventos_auth_data"    ON "usuario_eventos_auth"("data_evento");

ALTER TABLE "usuario_eventos_auth"
  ADD CONSTRAINT "fk_eventos_auth_usuario"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL;

-- =============================================================================
-- CREATE: usuario_resets_senha
-- =============================================================================

CREATE TABLE "usuario_resets_senha" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "usuario_id"     UUID          NOT NULL,
  "token_hash"     VARCHAR(255)  NOT NULL,
  "utilizado"      BOOLEAN       NOT NULL DEFAULT false,
  "data_expiracao" TIMESTAMPTZ(6) NOT NULL,
  "criado_em"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "usuario_resets_senha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_resets_senha_token_hash" ON "usuario_resets_senha"("token_hash");

ALTER TABLE "usuario_resets_senha"
  ADD CONSTRAINT "fk_resets_senha_usuario"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE;
