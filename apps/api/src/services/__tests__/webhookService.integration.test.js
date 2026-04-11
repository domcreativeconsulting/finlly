/**
 * Integration tests for webhookService.processarWebhookAsaas
 *
 * Uses a real PostgreSQL test database (TEST_DATABASE_URL).
 * Only mocks: config/env.js, logger.js, auditoria.service.js, utils/redisClient.js
 *
 * Run with: npm run test:integration --workspace=apps/api
 */

// ---------------------------------------------------------------------------
// Set test DATABASE_URL before any module is loaded
// ---------------------------------------------------------------------------
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks (must be declared before dynamic imports)
// ---------------------------------------------------------------------------
jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    ASAAS_WEBHOOK_SECRET: undefined,
    NODE_ENV: 'test',
  },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.unstable_mockModule('../auditoria.service.js', () => ({
  registrarEvento: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    del: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
  }),
}));

// ---------------------------------------------------------------------------
// Controlled mock for assinanteStatusService to allow failure injection
// ---------------------------------------------------------------------------
const assinanteStatusMockState = { shouldThrow: false };

jest.unstable_mockModule('../assinanteStatusService.js', async () => {
  const real = await jest.importActual('../assinanteStatusService.js');
  return {
    mapAsaasStatusToLocal: real.mapAsaasStatusToLocal,
    atualizarStatusAssinante: jest.fn(async (...args) => {
      if (assinanteStatusMockState.shouldThrow) {
        throw new Error('Simulated internal error');
      }
      return real.atualizarStatusAssinante(...args);
    }),
  };
});

// ---------------------------------------------------------------------------
// Test DB helpers & fixtures
// ---------------------------------------------------------------------------
let prismaTest, cleanDb, disconnectDb;
let createUsuario, createAssinante, createWebhookEvent;
let makePaymentConfirmedPayload, makePaymentOverduePayload;

// Service under test
let processarWebhookAsaas;

beforeAll(async () => {
  const db = await import('../../tests/helpers/db.js');
  prismaTest = db.prismaTest;
  cleanDb = db.cleanDb;
  disconnectDb = db.disconnectDb;

  const fixtures = await import('../../tests/fixtures/webhookFixtures.js');
  createUsuario = fixtures.createUsuario;
  createAssinante = fixtures.createAssinante;
  createWebhookEvent = fixtures.createWebhookEvent;
  makePaymentConfirmedPayload = fixtures.makePaymentConfirmedPayload;
  makePaymentOverduePayload = fixtures.makePaymentOverduePayload;

  const mod = await import('../webhookService.js');
  processarWebhookAsaas = mod.processarWebhookAsaas;
});

beforeEach(async () => {
  assinanteStatusMockState.shouldThrow = false;
  await cleanDb();
});

afterAll(async () => {
  await disconnectDb();
});

// ---------------------------------------------------------------------------
// Cenário 1 — PAYMENT_CONFIRMED processado corretamente
// ---------------------------------------------------------------------------

describe('Cenário 1 — PAYMENT_CONFIRMED processado corretamente', () => {
  test('atualiza status do assinante para ativo e cria pagamento', async () => {
    const usuario = await createUsuario(prismaTest);
    const assinante = await createAssinante(prismaTest, usuario.id, { status: 'pendente' });

    const eventId = `evt-c1-${Date.now()}`;
    const paymentId = `pay-c1-${Date.now()}`;
    const payload = makePaymentConfirmedPayload(eventId, usuario.id, assinante.provider_subscription_id, {
      paymentId,
    });

    const result = await processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });

    const assinanteAtualizado = await prismaTest.assinante.findUnique({ where: { id: assinante.id } });
    expect(assinanteAtualizado.status).toBe('ativo');

    const pagamentos = await prismaTest.assinantePagamento.findMany({
      where: { provider_payment_id: paymentId, provider: 'asaas' },
    });
    expect(pagamentos).toHaveLength(1);
    expect(pagamentos[0].status).toBe('pago');

    const evento = await prismaTest.webhookEvent.findFirst({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(evento).not.toBeNull();
    expect(evento.processado).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cenário 2 — Mesmo webhook enviado duas vezes (idempotência por event_id)
// ---------------------------------------------------------------------------

describe('Cenário 2 — Idempotência: mesmo webhook duplicado', () => {
  test('segunda chamada retorna skipped sem duplicar registros', async () => {
    const usuario = await createUsuario(prismaTest);
    const assinante = await createAssinante(prismaTest, usuario.id, { status: 'pendente' });

    const eventId = `evt-c2-${Date.now()}`;
    const paymentId = `pay-c2-${Date.now()}`;
    const payload = makePaymentConfirmedPayload(eventId, usuario.id, assinante.provider_subscription_id, {
      paymentId,
    });

    // First call — should process normally
    await processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined);

    // Second call — should be skipped
    const result = await processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined);

    expect(result).toEqual({ skipped: true });

    const pagamentos = await prismaTest.assinantePagamento.findMany({
      where: { provider_payment_id: paymentId, provider: 'asaas' },
    });
    expect(pagamentos).toHaveLength(1);

    const assinanteAtualizado = await prismaTest.assinante.findUnique({ where: { id: assinante.id } });
    expect(assinanteAtualizado.status).toBe('ativo');

    const eventos = await prismaTest.webhookEvent.findMany({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(eventos).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cenário 3 — Replay lógico: event_id já processado no banco
// ---------------------------------------------------------------------------

describe('Cenário 3 — Replay com evento já processado no banco', () => {
  test('retorna skipped sem criar novos registros', async () => {
    const usuario = await createUsuario(prismaTest);
    const assinante = await createAssinante(prismaTest, usuario.id, { status: 'pendente' });

    const eventId = `evt-c3-${Date.now()}`;
    const paymentId = `pay-c3-${Date.now()}`;
    const payload = makePaymentConfirmedPayload(eventId, usuario.id, assinante.provider_subscription_id, {
      paymentId,
    });

    // Pre-create the event as already processed
    await createWebhookEvent(prismaTest, {
      event_id: eventId,
      event_type: 'PAYMENT_CONFIRMED',
      payload,
      processado: true,
    });

    const result = await processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined);

    expect(result).toEqual({ skipped: true });

    const pagamentos = await prismaTest.assinantePagamento.findMany({
      where: { provider_payment_id: paymentId, provider: 'asaas' },
    });
    expect(pagamentos).toHaveLength(0);

    const eventos = await prismaTest.webhookEvent.findMany({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(eventos).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cenário 4 — PAYMENT_OVERDUE antes de PAYMENT_CONFIRMED (fora de ordem)
// ---------------------------------------------------------------------------

describe('Cenário 4 — Eventos fora de ordem (OVERDUE → CONFIRMED)', () => {
  test('OVERDUE marca inadimplente; CONFIRMED restaura ativo', async () => {
    const usuario = await createUsuario(prismaTest);
    const assinante = await createAssinante(prismaTest, usuario.id, { status: 'ativo' });

    const overdueEventId = `evt-c4-overdue-${Date.now()}`;
    const overduePaymentId = `pay-c4-overdue-${Date.now()}`;
    const overduePayload = makePaymentOverduePayload(overdueEventId, usuario.id, assinante.provider_subscription_id, {
      paymentId: overduePaymentId,
    });

    await processarWebhookAsaas(overduePayload, Buffer.from(JSON.stringify(overduePayload)), undefined);

    const assinanteOverdue = await prismaTest.assinante.findUnique({ where: { id: assinante.id } });
    expect(assinanteOverdue.status).toBe('inadimplente');

    const confirmedEventId = `evt-c4-confirmed-${Date.now()}`;
    const confirmedPaymentId = `pay-c4-confirmed-${Date.now()}`;
    const confirmedPayload = makePaymentConfirmedPayload(confirmedEventId, usuario.id, assinante.provider_subscription_id, {
      paymentId: confirmedPaymentId,
    });

    await processarWebhookAsaas(confirmedPayload, Buffer.from(JSON.stringify(confirmedPayload)), undefined);

    const assinanteRestaurado = await prismaTest.assinante.findUnique({ where: { id: assinante.id } });
    expect(assinanteRestaurado.status).toBe('ativo');
  });
});

// ---------------------------------------------------------------------------
// Cenário 5 — PAYMENT_CONFIRMED após PAYMENT_OVERDUE (ordem normal)
// ---------------------------------------------------------------------------

describe('Cenário 5 — PAYMENT_CONFIRMED após PAYMENT_OVERDUE (ordem normal)', () => {
  test('ativa assinante inadimplente e registra pagamento', async () => {
    const usuario = await createUsuario(prismaTest);
    const assinante = await createAssinante(prismaTest, usuario.id, { status: 'inadimplente' });

    const eventId = `evt-c5-${Date.now()}`;
    const paymentId = `pay-c5-${Date.now()}`;
    const payload = makePaymentConfirmedPayload(eventId, usuario.id, assinante.provider_subscription_id, {
      paymentId,
    });

    const result = await processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });

    const assinanteAtualizado = await prismaTest.assinante.findUnique({ where: { id: assinante.id } });
    expect(assinanteAtualizado.status).toBe('ativo');

    const pagamentos = await prismaTest.assinantePagamento.findMany({
      where: { provider_payment_id: paymentId, provider: 'asaas' },
    });
    expect(pagamentos).toHaveLength(1);
    expect(pagamentos[0].status).toBe('pago');
  });
});

// ---------------------------------------------------------------------------
// Cenário 6 — Falha durante processamento: banco não em meio estado
// ---------------------------------------------------------------------------

describe('Cenário 6 — Falha durante processamento', () => {
  test('rejeita com erro, marca evento com erro, não altera status do assinante', async () => {
    const usuario = await createUsuario(prismaTest);
    const assinante = await createAssinante(prismaTest, usuario.id, { status: 'pendente' });

    const eventId = `evt-c6-${Date.now()}`;
    const paymentId = `pay-c6-${Date.now()}`;
    const payload = makePaymentConfirmedPayload(eventId, usuario.id, assinante.provider_subscription_id, {
      paymentId,
    });

    assinanteStatusMockState.shouldThrow = true;

    await expect(
      processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined),
    ).rejects.toThrow('Simulated internal error');

    const evento = await prismaTest.webhookEvent.findFirst({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(evento).not.toBeNull();
    expect(evento.processado).toBe(false);
    expect(evento.erro).not.toBeNull();

    const assinanteNaoAlterado = await prismaTest.assinante.findUnique({ where: { id: assinante.id } });
    expect(assinanteNaoAlterado.status).toBe('pendente');
  });
});

// ---------------------------------------------------------------------------
// Cenário 7 — Webhook sem subscriber local correspondente
// ---------------------------------------------------------------------------

describe('Cenário 7 — Webhook sem assinante local', () => {
  test('processa sem erro, nenhum pagamento criado, evento marcado como processado', async () => {
    const eventId = `evt-c7-${Date.now()}`;
    const payload = makePaymentConfirmedPayload(eventId, 'usuario-inexistente-uuid-0000', 'sub-inexistente-0000', {
      paymentId: `pay-c7-${Date.now()}`,
    });

    const result = await processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });

    const pagamentos = await prismaTest.assinantePagamento.findMany();
    expect(pagamentos).toHaveLength(0);

    const evento = await prismaTest.webhookEvent.findFirst({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(evento).not.toBeNull();
    expect(evento.processado).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cenário 8 — Payload inválido/incompleto
// ---------------------------------------------------------------------------

describe('Cenário 8 — Payload inválido ou incompleto', () => {
  test('evento com tipo desconhecido é ignorado graciosamente e marcado processado', async () => {
    const eventId = `evt-c8a-${Date.now()}`;
    const payload = { id: eventId, event: 'UNKNOWN_EVENT_XYZ_99' };

    const result = await processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined);

    expect(result).toEqual({ processed: true, event: 'UNKNOWN_EVENT_XYZ_99' });

    const pagamentos = await prismaTest.assinantePagamento.findMany();
    expect(pagamentos).toHaveLength(0);

    const evento = await prismaTest.webhookEvent.findFirst({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(evento).not.toBeNull();
    expect(evento.processado).toBe(true);
  });

  test('payload com externalReference nulo não cria pagamentos indevidos', async () => {
    const eventId = `evt-c8b-${Date.now()}`;
    // Payload has event and payment but externalReference points to a non-existent user
    const payload = {
      id: eventId,
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: `pay-c8b-${Date.now()}`,
        externalReference: '00000000-0000-0000-0000-000000000000',
        subscription: null,
        value: 0,
      },
    };

    const result = await processarWebhookAsaas(payload, Buffer.from(JSON.stringify(payload)), undefined);

    // Service processes gracefully: no subscriber found → logs warning, continues
    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });

    const pagamentos = await prismaTest.assinantePagamento.findMany();
    expect(pagamentos).toHaveLength(0);

    const evento = await prismaTest.webhookEvent.findFirst({
      where: { provider: 'asaas', event_id: eventId },
    });
    expect(evento).not.toBeNull();
    expect(evento.processado).toBe(true);
  });
});
