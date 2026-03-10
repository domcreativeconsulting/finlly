-- AlterTable: add profile preference fields to usuarios
ALTER TABLE "usuarios"
  ADD COLUMN "whatsapp" VARCHAR(20),
  ADD COLUMN "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN "moeda" VARCHAR(10) NOT NULL DEFAULT 'BRL';
