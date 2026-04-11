import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// DB factory helpers
// ---------------------------------------------------------------------------

let _counter = 0;
function uid() {
  return `test-${Date.now()}-${++_counter}`;
}

/**
 * Creates a test Usuario in the database.
 */
export async function createUsuario(prisma, overrides = {}) {
  return prisma.usuario.create({
    data: {
      nome: overrides.nome ?? 'Test User',
      email: overrides.email ?? `test-${uid()}@test.com`,
      senha_hash: overrides.senha_hash ?? '$2b$10$testhashedpassword00000000',
      status: overrides.status ?? 'ativo',
      role: overrides.role ?? 'user',
    },
  });
}

/**
 * Creates a test Assinante linked to a usuario.
 */
export async function createAssinante(prisma, usuarioId, overrides = {}) {
  return prisma.assinante.create({
    data: {
      usuario_id: usuarioId,
      provider: overrides.provider ?? 'asaas',
      provider_subscription_id: overrides.provider_subscription_id ?? `sub_${uid()}`,
      provider_customer_id: overrides.provider_customer_id ?? `cus_${uid()}`,
      status: overrides.status ?? 'pendente',
      plano: overrides.plano ?? 'mensal',
    },
  });
}

/**
 * Creates a test AssinantePagamento.
 */
export async function createAssinantePagamento(prisma, assinanteId, usuarioId, overrides = {}) {
  return prisma.assinantePagamento.create({
    data: {
      assinante_id: assinanteId,
      usuario_id: usuarioId,
      status: overrides.status ?? 'pendente',
      valor: overrides.valor ?? 29.9,
      provider: overrides.provider ?? 'asaas',
      provider_payment_id: overrides.provider_payment_id ?? `pay_${uid()}`,
      descricao: overrides.descricao ?? 'Plano mensal',
      data_pagamento: overrides.data_pagamento ?? null,
      data_vencimento: overrides.data_vencimento ?? new Date('2026-05-01'),
    },
  });
}

/**
 * Creates a WebhookEvent already marked as processed (for deduplication tests).
 */
export async function createWebhookEvent(prisma, overrides = {}) {
  const payload = overrides.payload ?? { id: `evt_${uid()}`, event: 'PAYMENT_CONFIRMED' };
  const payloadHash =
    overrides.payload_hash ??
    createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  return prisma.webhookEvent.create({
    data: {
      provider: overrides.provider ?? 'asaas',
      event_id: overrides.event_id ?? String(payload.id),
      event_type: overrides.event_type ?? payload.event ?? 'PAYMENT_CONFIRMED',
      payload,
      payload_hash: payloadHash,
      processado: overrides.processado ?? true,
      processado_em: overrides.processado_em ?? new Date(),
      erro: overrides.erro ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Payload factories
// ---------------------------------------------------------------------------

/**
 * Returns a well-formed Asaas PAYMENT_CONFIRMED webhook payload.
 */
export function makePaymentConfirmedPayload(eventId, usuarioId, subscriptionId, overrides = {}) {
  return {
    id: eventId,
    event: 'PAYMENT_CONFIRMED',
    payment: {
      id: overrides.paymentId ?? `pay_${eventId}`,
      value: overrides.value ?? 29.9,
      dueDate: overrides.dueDate ?? '2026-05-01',
      paymentDate: overrides.paymentDate ?? '2026-04-10',
      externalReference: usuarioId,
      subscription: subscriptionId,
      description: overrides.description ?? 'Plano mensal',
      ...overrides.payment,
    },
  };
}

/**
 * Returns a well-formed Asaas PAYMENT_OVERDUE webhook payload.
 */
export function makePaymentOverduePayload(eventId, usuarioId, subscriptionId, overrides = {}) {
  return {
    id: eventId,
    event: 'PAYMENT_OVERDUE',
    payment: {
      id: overrides.paymentId ?? `pay_${eventId}`,
      value: overrides.value ?? 29.9,
      dueDate: overrides.dueDate ?? '2026-04-01',
      externalReference: usuarioId,
      subscription: subscriptionId,
      description: overrides.description ?? 'Plano mensal',
      ...overrides.payment,
    },
  };
}

/**
 * Returns a well-formed Asaas PAYMENT_DELETED webhook payload.
 */
export function makePaymentDeletedPayload(eventId, usuarioId, subscriptionId, overrides = {}) {
  return {
    id: eventId,
    event: 'PAYMENT_DELETED',
    payment: {
      id: overrides.paymentId ?? `pay_${eventId}`,
      value: overrides.value ?? 29.9,
      externalReference: usuarioId,
      subscription: subscriptionId,
      ...overrides.payment,
    },
  };
}
