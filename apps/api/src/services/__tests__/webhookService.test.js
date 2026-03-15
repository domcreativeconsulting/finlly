import { jest } from '@jest/globals';
import { createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  webhookEvent: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  assinante: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  assinantePagamento: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  usuario: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    ASAAS_WEBHOOK_SECRET: 'test-webhook-secret',
  },
}));

// ---------------------------------------------------------------------------
// Service under test
// ---------------------------------------------------------------------------

let processarWebhookAsaas;

beforeAll(async () => {
  const mod = await import('../webhookService.js');
  processarWebhookAsaas = mod.processarWebhookAsaas;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
});

// ---------------------------------------------------------------------------
// Helper: build valid HMAC signature
// ---------------------------------------------------------------------------

function buildSignature(rawBody, secret = 'test-webhook-secret') {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function makePayload(overrides = {}) {
  return {
    id: 'evt_test_001',
    event: 'PAYMENT_CONFIRMED',
    payment: {
      id: 'pay_001',
      customer: 'cus_001',
      subscription: 'sub_001',
      value: 29.90,
      status: 'CONFIRMED',
      paymentDate: '2024-01-15',
      dueDate: '2024-02-15',
      externalReference: 'user-uuid-1',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// HMAC validation
// ---------------------------------------------------------------------------

describe('processarWebhookAsaas — HMAC validation', () => {
  test('throws unauthorized if HMAC signature is invalid', async () => {
    const rawBody = Buffer.from(JSON.stringify(makePayload()));
    const invalidSignature = 'invalid-signature-000';

    await expect(
      processarWebhookAsaas(rawBody, invalidSignature, makePayload()),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  test('proceeds if HMAC signature is valid', async () => {
    const payload = makePayload();
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = buildSignature(rawBody);

    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 1n });
    mockPrisma.assinante.findFirst.mockResolvedValue({
      id: 'assinante-1',
      usuario_id: 'user-uuid-1',
      proxima_cobranca: new Date(Date.now() + 86400000),
    });
    mockPrisma.assinantePagamento.findFirst.mockResolvedValue(null);
    mockPrisma.assinantePagamento.create.mockResolvedValue({});
    mockPrisma.assinante.update.mockResolvedValue({});
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    await expect(
      processarWebhookAsaas(rawBody, signature, payload),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// PAYMENT_CONFIRMED event
// ---------------------------------------------------------------------------

describe('processarWebhookAsaas — PAYMENT_CONFIRMED', () => {
  test('updates payment status to pago and subscriber to ativo', async () => {
    const payload = makePayload({ event: 'PAYMENT_CONFIRMED' });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = buildSignature(rawBody);

    const mockAssinante = {
      id: 'assinante-1',
      usuario_id: 'user-uuid-1',
      proxima_cobranca: new Date(),
    };

    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 1n });
    mockPrisma.assinante.findFirst.mockResolvedValue(mockAssinante);
    mockPrisma.assinantePagamento.findFirst.mockResolvedValue(null);
    mockPrisma.assinantePagamento.create.mockResolvedValue({});
    mockPrisma.assinante.update.mockResolvedValue({});
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    await processarWebhookAsaas(rawBody, signature, payload);

    expect(mockPrisma.assinantePagamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pago',
          provider_payment_id: 'pay_001',
        }),
      }),
    );

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ativo' }),
      }),
    );

    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-uuid-1' },
        data: expect.objectContaining({ status: 'ativo' }),
      }),
    );
  });

  test('updates existing payment record if found', async () => {
    const payload = makePayload({ event: 'PAYMENT_CONFIRMED' });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = buildSignature(rawBody);

    const mockAssinante = {
      id: 'assinante-1',
      usuario_id: 'user-uuid-1',
      proxima_cobranca: new Date(),
    };

    const existingPayment = { id: 'pagamento-1' };

    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 1n });
    mockPrisma.assinante.findFirst.mockResolvedValue(mockAssinante);
    mockPrisma.assinantePagamento.findFirst.mockResolvedValue(existingPayment);
    mockPrisma.assinantePagamento.update.mockResolvedValue({});
    mockPrisma.assinante.update.mockResolvedValue({});
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    await processarWebhookAsaas(rawBody, signature, payload);

    expect(mockPrisma.assinantePagamento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pagamento-1' },
        data: expect.objectContaining({ status: 'pago' }),
      }),
    );

    expect(mockPrisma.assinantePagamento.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe('processarWebhookAsaas — idempotency', () => {
  test('ignores already processed event (idempotent)', async () => {
    const payload = makePayload();
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = buildSignature(rawBody);

    // Simulate P2002 unique constraint error on insert
    const p2002Error = new Error('Unique constraint violation');
    p2002Error.code = 'P2002';
    mockPrisma.webhookEvent.create.mockRejectedValue(p2002Error);

    // Simulate already-processed event
    mockPrisma.webhookEvent.findFirst.mockResolvedValue({
      id: 1n,
      processado: true,
    });

    await processarWebhookAsaas(rawBody, signature, payload);

    // Should return early without processing
    expect(mockPrisma.assinante.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.assinantePagamento.create).not.toHaveBeenCalled();
  });

  test('reprocesses event if previously failed (processado=false)', async () => {
    const payload = makePayload({ event: 'PAYMENT_CONFIRMED' });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = buildSignature(rawBody);

    const p2002Error = new Error('Unique constraint violation');
    p2002Error.code = 'P2002';
    mockPrisma.webhookEvent.create.mockRejectedValue(p2002Error);

    // Simulate failed/unprocessed event
    const failedWebhookEvent = { id: 2n, processado: false };
    mockPrisma.webhookEvent.findFirst.mockResolvedValue(failedWebhookEvent);

    const mockAssinante = {
      id: 'assinante-1',
      usuario_id: 'user-uuid-1',
      proxima_cobranca: new Date(),
    };
    mockPrisma.assinante.findFirst.mockResolvedValue(mockAssinante);
    mockPrisma.assinantePagamento.findFirst.mockResolvedValue(null);
    mockPrisma.assinantePagamento.create.mockResolvedValue({});
    mockPrisma.assinante.update.mockResolvedValue({});
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    await processarWebhookAsaas(rawBody, signature, payload);

    expect(mockPrisma.assinante.findFirst).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PAYMENT_OVERDUE — grace period
// ---------------------------------------------------------------------------

describe('processarWebhookAsaas — PAYMENT_OVERDUE', () => {
  test('does NOT block user within grace period', async () => {
    const payload = makePayload({
      event: 'PAYMENT_OVERDUE',
      payment: {
        id: 'pay_002',
        customer: 'cus_001',
        subscription: 'sub_001',
        value: 29.90,
        status: 'OVERDUE',
        externalReference: 'user-uuid-1',
      },
    });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = buildSignature(rawBody);

    // proxima_cobranca is recent (within grace period)
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 1n });
    mockPrisma.assinante.findFirst.mockResolvedValue({
      id: 'assinante-1',
      usuario_id: 'user-uuid-1',
      status: 'ativo',
      proxima_cobranca: recentDate,
    });
    mockPrisma.assinantePagamento.findFirst.mockResolvedValue(null);
    mockPrisma.assinantePagamento.create.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    await processarWebhookAsaas(rawBody, signature, payload);

    // Should NOT update subscriber to inadimplente
    expect(mockPrisma.assinante.update).not.toHaveBeenCalled();
    expect(mockPrisma.usuario.update).not.toHaveBeenCalled();
  });

  test('blocks user after grace period expires', async () => {
    const payload = makePayload({
      event: 'PAYMENT_OVERDUE',
      payment: {
        id: 'pay_003',
        customer: 'cus_001',
        subscription: 'sub_001',
        value: 29.90,
        status: 'OVERDUE',
        externalReference: 'user-uuid-1',
      },
    });
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = buildSignature(rawBody);

    // proxima_cobranca is well past grace period (10 days ago)
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 1n });
    mockPrisma.assinante.findFirst.mockResolvedValue({
      id: 'assinante-1',
      usuario_id: 'user-uuid-1',
      status: 'ativo',
      proxima_cobranca: oldDate,
    });
    mockPrisma.assinantePagamento.findFirst.mockResolvedValue(null);
    mockPrisma.assinantePagamento.create.mockResolvedValue({});
    mockPrisma.assinante.update.mockResolvedValue({});
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.webhookEvent.update.mockResolvedValue({});

    await processarWebhookAsaas(rawBody, signature, payload);

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'inadimplente' }),
      }),
    );

    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-uuid-1' },
        data: expect.objectContaining({ status: 'bloqueado_inadimplencia' }),
      }),
    );
  });
});
