import { jest } from '@jest/globals';
import { createHmac } from 'crypto';
import { Buffer } from 'buffer';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  webhookEvent: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  assinante: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  assinantePagamento: {
    create: jest.fn(),
  },
  usuario: {
    update: jest.fn(),
  },
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const WEBHOOK_SECRET = 'test_webhook_secret_32_chars_min!';

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    ASAAS_WEBHOOK_SECRET: WEBHOOK_SECRET,
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
  // Default: evento não existe (novo)
  mockPrisma.webhookEvent.findFirst.mockResolvedValue(null);
  mockPrisma.webhookEvent.create.mockResolvedValue({ id: 1n });
  mockPrisma.webhookEvent.update.mockResolvedValue({});
  mockPrisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.assinante.update.mockResolvedValue({});
  mockPrisma.assinantePagamento.create.mockResolvedValue({});
  mockPrisma.usuario.update.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ASSINANTE = {
  id: 'assinante-uuid-001',
  usuario_id: 'usuario-uuid-001',
  status: 'ativo',
  provider_subscription_id: 'sub_asaas_001',
};

function makePayload(event, overrides = {}) {
  return {
    id: 'evt_001',
    event,
    payment: {
      id: 'pay_001',
      value: 29.9,
      dueDate: '2026-04-01',
      paymentDate: '2026-03-15',
      externalReference: ASSINANTE.usuario_id,
      subscription: ASSINANTE.provider_subscription_id,
      description: 'Plano mensal',
      ...overrides,
    },
  };
}

function makeSignature(rawBody) {
  return createHmac('sha256', WEBHOOK_SECRET)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Tests: signature validation
// ---------------------------------------------------------------------------

describe('verificação de assinatura', () => {
  test('rejeita assinatura inválida com AppError 401', async () => {
    const payload = makePayload('PAYMENT_CONFIRMED');
    const rawBody = Buffer.from(JSON.stringify(payload));

    await expect(
      processarWebhookAsaas(payload, rawBody, 'assinatura_invalida_hex'),
    ).rejects.toMatchObject({ status: 401 });
  });

  test('aceita assinatura válida', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    const payload = makePayload('PAYMENT_CONFIRMED');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);
    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });
  });
});

// ---------------------------------------------------------------------------
// Tests: idempotency
// ---------------------------------------------------------------------------

describe('idempotência', () => {
  test('evento já processado (processado=true) → retorna { skipped: true } sem chamar handlers', async () => {
    mockPrisma.webhookEvent.findFirst.mockResolvedValue({
      id: 1n,
      processado: true,
      erro: null,
    });

    const payload = makePayload('PAYMENT_CONFIRMED');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ skipped: true });
    expect(mockPrisma.assinante.update).not.toHaveBeenCalled();
  });

  test('evento em andamento (processado=false, erro=null, exists) → retorna { skipped: true }', async () => {
    mockPrisma.webhookEvent.findFirst.mockResolvedValue({
      id: 1n,
      processado: false,
      erro: null,
    });

    const payload = makePayload('PAYMENT_CONFIRMED');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ skipped: true });
    expect(mockPrisma.assinante.update).not.toHaveBeenCalled();
  });

  test('evento que falhou antes (processado=false, erro!=null) → reprocessa', async () => {
    mockPrisma.webhookEvent.findFirst.mockResolvedValue({
      id: 1n,
      processado: false,
      erro: 'Erro anterior',
    });
    mockPrisma.webhookEvent.update.mockResolvedValue({});
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);

    const payload = makePayload('PAYMENT_CONFIRMED');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });
    expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ erro: null }) }),
    );
    expect(mockPrisma.assinante.update).toHaveBeenCalled();
  });

  test('evento novo (não existe) → cria e processa', async () => {
    mockPrisma.webhookEvent.findFirst.mockResolvedValue(null);
    mockPrisma.webhookEvent.create.mockResolvedValue({ id: 2n });
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);

    const payload = makePayload('PAYMENT_CONFIRMED');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });
    expect(mockPrisma.webhookEvent.create).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: PAYMENT_CONFIRMED
// ---------------------------------------------------------------------------

describe('PAYMENT_CONFIRMED', () => {
  test('atualiza assinante.status = ativo, cria pagamento, atualiza usuario.status = ativo', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    const payload = makePayload('PAYMENT_CONFIRMED');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_CONFIRMED' });

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ASSINANTE.id },
        data: expect.objectContaining({ status: 'ativo' }),
      }),
    );

    expect(mockPrisma.assinantePagamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pago', usuario_id: ASSINANTE.usuario_id }),
      }),
    );

    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ASSINANTE.usuario_id },
        data: { status: 'ativo' },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: PAYMENT_RECEIVED
// ---------------------------------------------------------------------------

describe('PAYMENT_RECEIVED', () => {
  test('atualiza assinante.status = ativo e cria pagamento como pago', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    const payload = makePayload('PAYMENT_RECEIVED');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_RECEIVED' });
    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ativo' }) }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: PAYMENT_OVERDUE
// ---------------------------------------------------------------------------

describe('PAYMENT_OVERDUE', () => {
  test('atualiza assinante.status = inadimplente e usuario.status = bloqueado_inadimplencia', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    const payload = makePayload('PAYMENT_OVERDUE');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_OVERDUE' });

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ASSINANTE.id },
        data: { status: 'inadimplente' },
      }),
    );

    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ASSINANTE.usuario_id },
        data: { status: 'bloqueado_inadimplencia' },
      }),
    );

    expect(mockPrisma.assinantePagamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pendente' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: PAYMENT_DELETED
// ---------------------------------------------------------------------------

describe('PAYMENT_DELETED', () => {
  test('atualiza assinante.status = cancelado e usuario.status = ativo', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    const payload = makePayload('PAYMENT_DELETED');
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'PAYMENT_DELETED' });

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ASSINANTE.id },
        data: { status: 'cancelado' },
      }),
    );

    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ASSINANTE.usuario_id },
        data: { status: 'ativo' },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: SUBSCRIPTION_DELETED
// ---------------------------------------------------------------------------

describe('SUBSCRIPTION_DELETED', () => {
  test('atualiza assinante.status = cancelado', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    const payload = {
      id: 'evt_002',
      event: 'SUBSCRIPTION_DELETED',
      subscription: {
        id: ASSINANTE.provider_subscription_id,
        externalReference: ASSINANTE.usuario_id,
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'SUBSCRIPTION_DELETED' });
    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'cancelado' },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: SUBSCRIPTION_UPDATED
// ---------------------------------------------------------------------------

describe('SUBSCRIPTION_UPDATED', () => {
  test('atualiza proxima_cobranca e status quando subscription tem nextDueDate e status ACTIVE', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    const payload = {
      id: 'evt_sub_upd_001',
      event: 'SUBSCRIPTION_UPDATED',
      subscription: {
        id: ASSINANTE.provider_subscription_id,
        externalReference: ASSINANTE.usuario_id,
        value: 49.9,
        nextDueDate: '2026-04-16',
        status: 'ACTIVE',
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'SUBSCRIPTION_UPDATED' });
    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ASSINANTE.id },
        data: expect.objectContaining({
          status: 'ativo',
        }),
      }),
    );
  });

  test('SUBSCRIPTION_UPDATED com status INACTIVE → assinante.status = cancelado', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    const payload = {
      id: 'evt_sub_upd_002',
      event: 'SUBSCRIPTION_UPDATED',
      subscription: {
        id: ASSINANTE.provider_subscription_id,
        externalReference: ASSINANTE.usuario_id,
        status: 'INACTIVE',
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'SUBSCRIPTION_UPDATED' });
    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'cancelado' }),
      }),
    );
  });

  test('SUBSCRIPTION_UPDATED sem assinante → não lança erro', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(null);
    const payload = {
      id: 'evt_sub_upd_003',
      event: 'SUBSCRIPTION_UPDATED',
      subscription: { id: 'sub_desconhecido', externalReference: null },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);
    expect(result).toEqual({ processed: true, event: 'SUBSCRIPTION_UPDATED' });
    expect(mockPrisma.assinante.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: unknown event
// ---------------------------------------------------------------------------

describe('evento desconhecido', () => {
  test('processa sem erro e retorna processed: true', async () => {
    const payload = { id: 'evt_003', event: 'UNKNOWN_EVENT' };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const sig = makeSignature(rawBody);

    const result = await processarWebhookAsaas(payload, rawBody, sig);

    expect(result).toEqual({ processed: true, event: 'UNKNOWN_EVENT' });
    expect(mockPrisma.assinante.update).not.toHaveBeenCalled();
  });
});
