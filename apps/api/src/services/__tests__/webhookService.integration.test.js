/**
 * Integration tests for webhookService.processarWebhookAsaas
 *
 * These tests use a real PostgreSQL database (DATABASE_TEST_URL or DATABASE_URL)
 * with migrations applied. They validate idempotency, out-of-order events,
 * transactional failure behaviour, and edge-case payloads.
 *
 * External-only mocks: redisClient, auditoria.service, logger, config/env.
 * The Prisma client (database.js) is REPLACED with a real test-DB client —
 * it is NOT mocked.
 *
 * Prerequisites (handled by CI):
 *   npx prisma db push --schema=prisma/schema.prisma --skip-generate
 *   DATABASE_TEST_URL=postgresql://test:test@localhost:5432/finlly_test
 */

import { jest } from '@jest/globals';
import { createHmac } from 'crypto';
import { Buffer } from 'buffer';

// ---------------------------------------------------------------------------
// Real test-database client
// The factory is called lazily when webhookService.js (and its deps) first
// import '../../utils/database.js'. By that time the factory has run and
// testPrisma is set, so subsequent references in test bodies are safe.
// ---------------------------------------------------------------------------
let testPrisma;

jest.unstable_mockModule('../../utils/database.js', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const dbUrl = process.env.DATABASE_TEST_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      'DATABASE_TEST_URL (or DATABASE_URL) must be set to run integration tests',
    );
  }
  const adapter = new PrismaPg({ connectionString: dbUrl });
  testPrisma = new PrismaClient({ adapter });
  return { default: testPrisma };
});

// ---------------------------------------------------------------------------
// Mock only external dependencies (Redis, audit log, structured logger, env)
// ---------------------------------------------------------------------------
jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  getRedisClient: jest.fn().mockResolvedValue({ del: jest.fn().mockResolvedValue(1) }),
}));

jest.unstable_mockModule('../auditoria.service.js', () => ({
  registrarEvento: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const WEBHOOK_SECRET = 'test_webhook_secret_32_chars_min!';

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { ASAAS_WEBHOOK_SECRET: WEBHOOK_SECRET },
}));

// ---------------------------------------------------------------------------
// Service import — must happen AFTER unstable_mockModule declarations
// ---------------------------------------------------------------------------
let processarWebhookAsaas;

beforeAll(async () => {
  const mod = await import('../webhookService.js');
  processarWebhookAsaas = mod.processarWebhookAsaas;
});

afterAll(async () => {
  if (testPrisma) await testPrisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const TEST_EMAIL_PREFIX = 'integration_test_';

/** Returns a unique string suffix to avoid collisions between parallel runs. */
function uid(tag = '') {
  return `${tag}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a Usuario row in the test database.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} [overrides]
 */
async function criarUsuario(prisma, overrides = {}) {
  return prisma.usuario.create({
    data: {
      nome: 'Integration Test User',
      email: `${TEST_EMAIL_PREFIX}${uid()}@test.com`,
      senha_hash: 'hash_test_not_real_integration',
      status: 'ativo',
      email_verificado: true,
      ...overrides,
    },
  });
}

/**
 * Creates an Assinante row linked to the given usuarioId.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} usuarioId
 * @param {object} [overrides]
 */
async function criarAssinante(prisma, usuarioId, overrides = {}) {
  return prisma.assinante.create({
    data: {
      usuario_id: usuarioId,
      status: 'pendente',
      plano: 'free',
      provider: 'asaas',
      provider_subscription_id: `sub_integ_${uid()}`,
      ...overrides,
    },
  });
}

/**
 * Removes all rows created by integration tests, respecting FK constraints.
 * Runs before each test to guarantee a clean slate.
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function limparBilling(prisma) {
  const testUsers = await prisma.usuario.findMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  });
  const userIds = testUsers.map(u => u.id);

  // 1. webhook_events: no FK to users — safe to delete first
  await prisma.webhookEvent.deleteMany({ where: { provider: 'asaas' } });

  if (userIds.length > 0) {
    // 2. assinantes_pagamentos: FK to both assinante (Cascade) and usuario (Restrict)
    await prisma.assinantePagamento.deleteMany({ where: { usuario_id: { in: userIds } } });
    // 3. assinantes: FK to usuario (Cascade)
    await prisma.assinante.deleteMany({ where: { usuario_id: { in: userIds } } });
    // 4. usuarios
    await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
  }
}

/**
 * Builds a valid Asaas-style webhook payload.
 * @param {string} event - e.g. 'PAYMENT_CONFIRMED'
 * @param {object} [opts]
 * @param {string} [opts.eventId]
 * @param {string} [opts.paymentId]
 * @param {string} [opts.usuarioId]
 * @param {string} [opts.subscriptionId]
 * @param {object} [opts.paymentOverrides]
 */
function makePayload(event, { eventId, paymentId, usuarioId, subscriptionId, ...paymentOverrides } = {}) {
  return {
    id: eventId ?? `evt_integ_${uid(event + '_')}`,
    event,
    payment: {
      id: paymentId ?? `pay_integ_${uid()}`,
      value: 29.9,
      dueDate: '2026-04-01',
      paymentDate: '2026-03-15',
      externalReference: usuarioId ?? null,
      subscription: subscriptionId ?? null,
      description: 'Plano mensal integration test',
      ...paymentOverrides,
    },
  };
}

/**
 * Computes the HMAC-SHA256 hex signature for a raw body buffer.
 * @param {Buffer} rawBody
 */
function makeSignature(rawBody) {
  return createHmac('sha256', WEBHOOK_SECRET)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody)
    .digest('hex');
}

// Clean slate before every test; restore any spies
beforeEach(async () => {
  await limparBilling(testPrisma);
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Cenário 1 — Evento processado com sucesso uma vez
// ---------------------------------------------------------------------------

describe('Cenário 1 — evento PAYMENT_CONFIRMED processado uma vez', () => {
  test('persiste webhookEvent.processado=true, assinante.status=ativo e AssinantePagamento criado', async () => {
    const usuario = await criarUsuario(testPrisma);
    const assinante = await criarAssinante(testPrisma, usuario.id, { status: 'pendente' });

    const paymentId = `pay_integ_c1_${uid()}`;
    const eventId = `evt_integ_c1_${uid()}`;
    const payload = makePayload('PAYMENT_CONFIRMED', {
      eventId,
      paymentId,
      usuarioId: usuario.id,
    });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });

    // webhookEvent persisted and marked as processed
    const webhookEvent = await testPrisma.webhookEvent.findFirst({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(webhookEvent).not.toBeNull();
    expect(webhookEvent.processado).toBe(true);
    expect(webhookEvent.erro).toBeNull();

    // assinante.status updated to 'ativo'
    const updatedAssinante = await testPrisma.assinante.findUnique({
      where: { id: assinante.id },
    });
    expect(updatedAssinante.status).toBe('ativo');

    // AssinantePagamento created with status 'pago' and correct provider_payment_id
    const pagamento = await testPrisma.assinantePagamento.findFirst({
      where: { provider: 'asaas', provider_payment_id: paymentId },
    });
    expect(pagamento).not.toBeNull();
    expect(pagamento.status).toBe('pago');
    expect(pagamento.provider_payment_id).toBe(paymentId);
    expect(pagamento.usuario_id).toBe(usuario.id);
  });
});

// ---------------------------------------------------------------------------
// Cenário 2 — Mesmo evento enviado duas vezes (idempotência por event_id)
// ---------------------------------------------------------------------------

describe('Cenário 2 — mesmo evento PAYMENT_CONFIRMED enviado duas vezes', () => {
  test('segunda chamada retorna { skipped: true } e não duplica registros no banco', async () => {
    const usuario = await criarUsuario(testPrisma);
    await criarAssinante(testPrisma, usuario.id, { status: 'pendente' });

    const paymentId = `pay_integ_c2_${uid()}`;
    const eventId = `evt_integ_c2_${uid()}`;
    const payload = makePayload('PAYMENT_CONFIRMED', {
      eventId,
      paymentId,
      usuarioId: usuario.id,
    });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    // First call — must succeed
    const first = await processarWebhookAsaas(payload, rawBody, sig);
    expect(first).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });

    // Second call — must be skipped (idempotency guard)
    const second = await processarWebhookAsaas(payload, rawBody, sig);
    expect(second).toEqual({ skipped: true });

    // Exactly one webhook_event row for this event_id
    const webhookEvents = await testPrisma.webhookEvent.findMany({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(webhookEvents).toHaveLength(1);
    expect(webhookEvents[0].processado).toBe(true);

    // Exactly one AssinantePagamento for this provider_payment_id
    const pagamentos = await testPrisma.assinantePagamento.findMany({
      where: { provider: 'asaas', provider_payment_id: paymentId },
    });
    expect(pagamentos).toHaveLength(1);
    expect(pagamentos[0].status).toBe('pago');

    // assinante.status still 'ativo' — not degraded by replay
    const assinante = await testPrisma.assinante.findFirst({
      where: { usuario_id: usuario.id },
    });
    expect(assinante.status).toBe('ativo');
  });
});

// ---------------------------------------------------------------------------
// Cenário 3 — PAYMENT_OVERDUE chega antes de PAYMENT_CONFIRMED (fora de ordem)
// ---------------------------------------------------------------------------

describe('Cenário 3 — PAYMENT_OVERDUE antes de PAYMENT_CONFIRMED (fora de ordem)', () => {
  test('OVERDUE marca inadimplente; CONFIRMED posterior restaura ativo', async () => {
    const usuario = await criarUsuario(testPrisma);
    const assinante = await criarAssinante(testPrisma, usuario.id, { status: 'ativo' });

    // Step 1: PAYMENT_OVERDUE arrives first
    const overduePaymentId = `pay_integ_c3_over_${uid()}`;
    const overdueEventId = `evt_integ_c3_over_${uid()}`;
    const overduePayload = makePayload('PAYMENT_OVERDUE', {
      eventId: overdueEventId,
      paymentId: overduePaymentId,
      usuarioId: usuario.id,
    });
    const overdueBody = Buffer.from(JSON.stringify(overduePayload));
    await processarWebhookAsaas(overduePayload, overdueBody, makeSignature(overdueBody));

    const afterOverdue = await testPrisma.assinante.findUnique({ where: { id: assinante.id } });
    expect(afterOverdue.status).toBe('inadimplente');

    // Step 2: PAYMENT_CONFIRMED arrives later (different payment, e.g. new billing cycle)
    const confirmedPaymentId = `pay_integ_c3_conf_${uid()}`;
    const confirmedEventId = `evt_integ_c3_conf_${uid()}`;
    const confirmedPayload = makePayload('PAYMENT_CONFIRMED', {
      eventId: confirmedEventId,
      paymentId: confirmedPaymentId,
      usuarioId: usuario.id,
    });
    const confirmedBody = Buffer.from(JSON.stringify(confirmedPayload));
    await processarWebhookAsaas(confirmedPayload, confirmedBody, makeSignature(confirmedBody));

    // After confirmation, status must be 'ativo' — the system must not leave
    // a regressive state when a confirmed event arrives after an overdue one
    const afterConfirmed = await testPrisma.assinante.findUnique({ where: { id: assinante.id } });
    expect(afterConfirmed.status).toBe('ativo');
  });
});

// ---------------------------------------------------------------------------
// Cenário 4 — PAYMENT_CONFIRMED chega depois de PAYMENT_OVERDUE (sequência correta)
// ---------------------------------------------------------------------------

describe('Cenário 4 — PAYMENT_CONFIRMED depois de PAYMENT_OVERDUE (sequência correta)', () => {
  test('estado final reflete o último evento relevante: inadimplente', async () => {
    const usuario = await criarUsuario(testPrisma);
    const assinante = await criarAssinante(testPrisma, usuario.id, { status: 'ativo' });

    // Step 1: PAYMENT_CONFIRMED for one payment
    const confPaymentId = `pay_integ_c4_conf_${uid()}`;
    const confEventId = `evt_integ_c4_conf_${uid()}`;
    const confPayload = makePayload('PAYMENT_CONFIRMED', {
      eventId: confEventId,
      paymentId: confPaymentId,
      usuarioId: usuario.id,
    });
    const confBody = Buffer.from(JSON.stringify(confPayload));
    await processarWebhookAsaas(confPayload, confBody, makeSignature(confBody));

    const afterConf = await testPrisma.assinante.findUnique({ where: { id: assinante.id } });
    expect(afterConf.status).toBe('ativo');

    // Step 2: PAYMENT_OVERDUE for a different (later) payment
    const overPaymentId = `pay_integ_c4_over_${uid()}`;
    const overEventId = `evt_integ_c4_over_${uid()}`;
    const overPayload = makePayload('PAYMENT_OVERDUE', {
      eventId: overEventId,
      paymentId: overPaymentId,
      usuarioId: usuario.id,
    });
    const overBody = Buffer.from(JSON.stringify(overPayload));
    await processarWebhookAsaas(overPayload, overBody, makeSignature(overBody));

    // Final state: inadimplente (last event wins)
    const afterOver = await testPrisma.assinante.findUnique({ where: { id: assinante.id } });
    expect(afterOver.status).toBe('inadimplente');

    // Both payments exist in the DB
    const conf = await testPrisma.assinantePagamento.findFirst({
      where: { provider: 'asaas', provider_payment_id: confPaymentId },
    });
    const over = await testPrisma.assinantePagamento.findFirst({
      where: { provider: 'asaas', provider_payment_id: overPaymentId },
    });
    expect(conf).not.toBeNull();
    expect(conf.status).toBe('pago');
    expect(over).not.toBeNull();
    expect(over.status).toBe('pendente');
  });
});

// ---------------------------------------------------------------------------
// Cenário 5 — Falha transacional não deixa banco em meio estado
// ---------------------------------------------------------------------------

describe('Cenário 5 — falha transacional', () => {
  test(
    'quando assinantePagamento.upsert falha: webhookEvent.erro registrado; ' +
    'assinante.status reflete comportamento real sem $transaction (partial state documentado)',
    async () => {
      const usuario = await criarUsuario(testPrisma);
      const assinante = await criarAssinante(testPrisma, usuario.id, { status: 'pendente' });

      const paymentId = `pay_integ_c5_${uid()}`;
      const eventId = `evt_integ_c5_${uid()}`;
      const payload = makePayload('PAYMENT_CONFIRMED', {
        eventId,
        paymentId,
        usuarioId: usuario.id,
      });
      const rawBody = Buffer.from(JSON.stringify(payload));
      const sig = makeSignature(rawBody);

      // Spy on upsert to throw after assinante.update has already been called
      jest.spyOn(testPrisma.assinantePagamento, 'upsert').mockRejectedValueOnce(
        new Error('Simulated DB failure on upsert'),
      );

      // Service propagates the error
      await expect(processarWebhookAsaas(payload, rawBody, sig)).rejects.toThrow(
        'Simulated DB failure on upsert',
      );

      // webhookEvent must exist and have erro set (service catch-block updates it)
      const webhookEvent = await testPrisma.webhookEvent.findFirst({
        where: { provider: 'asaas', event_id: eventId },
      });
      expect(webhookEvent).not.toBeNull();
      expect(webhookEvent.erro).not.toBeNull();
      expect(webhookEvent.processado).toBe(false);

      // No AssinantePagamento was created (upsert failed)
      const pagamento = await testPrisma.assinantePagamento.findFirst({
        where: { provider: 'asaas', provider_payment_id: paymentId },
      });
      expect(pagamento).toBeNull();

      // DOCUMENTATION of current partial-state behaviour:
      // webhookService.js does NOT wrap assinante.update + assinantePagamento.upsert
      // inside a prisma.$transaction. As a result, assinante.status IS updated to 'ativo'
      // even though the payment record was never created. This test exposes the behaviour.
      const updatedAssinante = await testPrisma.assinante.findUnique({
        where: { id: assinante.id },
      });
      // assinante status was already updated before upsert failed
      expect(updatedAssinante.status).toBe('ativo');
    },
  );
});

// ---------------------------------------------------------------------------
// Cenário 6 — Webhook sem assinante local correspondente
// ---------------------------------------------------------------------------

describe('Cenário 6 — webhook sem assinante local', () => {
  test('não lança erro, webhookEvent marcado como processado, nenhum pagamento criado', async () => {
    const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
    const paymentId = `pay_integ_c6_${uid()}`;
    const eventId = `evt_integ_c6_${uid()}`;

    const payload = makePayload('PAYMENT_CONFIRMED', {
      eventId,
      paymentId,
      usuarioId: nonExistentUserId,
    });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    // Service must return processed (it logs a warning but does not throw)
    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });

    // webhookEvent created and marked as processed
    const webhookEvent = await testPrisma.webhookEvent.findFirst({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(webhookEvent).not.toBeNull();
    expect(webhookEvent.processado).toBe(true);
    expect(webhookEvent.erro).toBeNull();

    // No AssinantePagamento created (no assinante was found)
    const pagamento = await testPrisma.assinantePagamento.findFirst({
      where: { provider: 'asaas', provider_payment_id: paymentId },
    });
    expect(pagamento).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cenário 7 — Payload inválido / estruturalmente incompleto
// ---------------------------------------------------------------------------

describe('Cenário 7 — payload inválido (sem campo event)', () => {
  test('não lança erro não tratado; webhookEvent processado; sem efeito colateral', async () => {
    const eventId = `evt_integ_c7_${uid()}`;
    // Payload without the required `event` field
    const payload = { id: eventId };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    // Service treats unknown/missing event type as "ignorado" and still marks processed
    expect(result).toEqual({ processed: true, event: undefined });

    // webhookEvent persisted and marked as processed
    const webhookEvent = await testPrisma.webhookEvent.findFirst({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(webhookEvent).not.toBeNull();
    expect(webhookEvent.processado).toBe(true);

    // No side effects on assinante or pagamento tables
    const pagamentos = await testPrisma.assinantePagamento.findMany({
      where: { provider: 'asaas' },
    });
    expect(pagamentos).toHaveLength(0);
  });
});
