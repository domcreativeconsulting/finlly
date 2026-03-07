-- Add utilizado_em column to usuario_resets_senha
ALTER TABLE "usuario_resets_senha" ADD COLUMN "utilizado_em" TIMESTAMPTZ(6);

-- Add indexes to usuario_resets_senha
CREATE INDEX IF NOT EXISTS "idx_resets_senha_usuario" ON "usuario_resets_senha"("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_resets_senha_expiracao" ON "usuario_resets_senha"("data_expiracao");

-- Create usuario_verificacoes_email table
CREATE TABLE "usuario_verificacoes_email" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id"     UUID         NOT NULL,
    "token_hash"     VARCHAR(255) NOT NULL,
    "verificado"     BOOLEAN      NOT NULL DEFAULT FALSE,
    "data_expiracao" TIMESTAMPTZ(6) NOT NULL,
    "criado_em"      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "verificado_em"  TIMESTAMPTZ(6),

    CONSTRAINT "usuario_verificacoes_email_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on token_hash
ALTER TABLE "usuario_verificacoes_email" ADD CONSTRAINT "uq_verificacoes_email_token_hash" UNIQUE ("token_hash");

-- Indexes
CREATE INDEX "idx_verificacoes_email_usuario" ON "usuario_verificacoes_email"("usuario_id");
CREATE INDEX "idx_verificacoes_email_expiracao" ON "usuario_verificacoes_email"("data_expiracao");

-- Foreign key to usuarios
ALTER TABLE "usuario_verificacoes_email" ADD CONSTRAINT "fk_verificacoes_email_usuario"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE;
