-- Migration: 04.2.3 — add unique constraint (provider, provider_payment_id) to assinantes_pagamentos
-- Rows with NULL provider_payment_id are excluded from the unique index (Postgres nulls are distinct)
CREATE UNIQUE INDEX uq_apagamentos_provider_payment
  ON assinantes_pagamentos (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
