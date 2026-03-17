import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  assinante: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  assinantePagamento: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  usuario: {
    update: jest.fn(),
  },
};

const mockRedis = {
  set: jest.fn(),
  del: jest.fn(),
};

const mockGetRedisClient = jest.fn();

const mockAsaas = {
  getSubscription: jest.fn(),
  getPaymentsBySubscription: jest.fn(),
};

const mockAtualizarStatusAssinante = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../utils/database.js', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../../utils/redisClient.js', () => ({ getRedisClient: mockGetRedisClient }));
jest.unstable_mockModule('../../lib/asaas/asaasClient.js', () => ({ asaas: mockAsaas }));
jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
jest.unstable_mockModule('../assinanteStatusService.js', () => ({
  atualizarStatusAssinante: mockAtualizarStatusAssinante,
  mapAsaasStatusToLocal: (status) => {
    switch (status) {
      case 'ACTIVE': return 'ativo';
      case 'PENDING': return 'pendente';
      case 'OVERDUE': return 'inadimplente';
      case 'INACTIVE':
      case 'CANCELLED': return 'cancelado';
      default: return null;
    }
  },
}));

// ---------------------------------------------------------------------------
// Service under test
// ---------------------------------------------------------------------------
let reconciliarAssinaturas;

beforeAll(async () => {
  const mod = await import('../reconciliacaoService.js');
  reconciliarAssinaturas = mod.reconciliarAssinaturas;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRedisClient.mockResolvedValue(mockRedis);
  mockRedis.set.mockResolvedValue('OK'); // lock acquired by default
  mockRedis.del.mockResolvedValue(1);
  mockPrisma.assinante.findMany.mockResolvedValue([]);
  mockPrisma.assinante.update.mockResolvedValue({});
  mockPrisma.assinantePagamento.findFirst.mockResolvedValue(null);
  mockPrisma.assinantePagamento.create.mockResolvedValue({});
  mockPrisma.assinantePagamento.update.mockResolvedValue({});
  mockPrisma.assinantePagamento.upsert.mockResolvedValue({});
  mockPrisma.usuario.update.mockResolvedValue({});
  mockAtualizarStatusAssinante.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ASSINANTE_ATIVO = {
  id: 'assinante-uuid-001',
  usuario_id: 'usuario-uuid-001',
  status: 'ativo',
  provider_subscription_id: 'sub_asaas_001',
};

const ASSINANTE_INADIMPLENTE = {
  id: 'assinante-uuid-002',
  usuario_id: 'usuario-uuid-002',
  status: 'inadimplente',
  provider_subscription_id: 'sub_asaas_002',
};

function makePaymentsResponse(overrides = []) {
  return {
    data: overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reconciliarAssinaturas', () => {
  describe('Redis lock', () => {
    it('returns { skipped: true } when lock is already acquired', async () => {
      mockRedis.set.mockResolvedValue(null); // NX returns null when key exists

      const result = await reconciliarAssinaturas();

      expect(result).toEqual({ skipped: true });
      expect(mockPrisma.assinante.findMany).not.toHaveBeenCalled();
    });

    it('releases lock in finally even when an error occurs', async () => {
      mockPrisma.assinante.findMany.mockRejectedValue(new Error('DB error'));

      await expect(reconciliarAssinaturas()).rejects.toThrow('DB error');

      expect(mockRedis.del).toHaveBeenCalledWith('reconciliacao:lock');
    });

    it('releases lock in finally on successful execution', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([]);

      await reconciliarAssinaturas();

      expect(mockRedis.del).toHaveBeenCalledWith('reconciliacao:lock');
    });
  });

  describe('Asaas ACTIVE status', () => {
    it('updates assinante to ativo and usuario to ativo when Asaas returns ACTIVE', async () => {
      const assinanteInadimplente = { ...ASSINANTE_ATIVO, status: 'inadimplente' };
      mockPrisma.assinante.findMany.mockResolvedValue([assinanteInadimplente]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'ACTIVE' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(makePaymentsResponse());

      const result = await reconciliarAssinaturas();

      expect(result).toEqual({ total: 1, atualizados: 1, erros: 0 });
      expect(mockAtualizarStatusAssinante).toHaveBeenCalledWith(
        assinanteInadimplente.id,
        assinanteInadimplente.usuario_id,
        'ativo',
      );
    });

    it('restores usuario to ativo if was bloqueado_inadimplencia when Asaas returns ACTIVE', async () => {
      const assinanteComStatusInadimplente = { ...ASSINANTE_ATIVO, status: 'inadimplente' };
      mockPrisma.assinante.findMany.mockResolvedValue([assinanteComStatusInadimplente]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'ACTIVE' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(makePaymentsResponse());

      await reconciliarAssinaturas();

      expect(mockAtualizarStatusAssinante).toHaveBeenCalledWith(
        assinanteComStatusInadimplente.id,
        assinanteComStatusInadimplente.usuario_id,
        'ativo',
      );
    });

    it('skips status update when status already matches', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([ASSINANTE_ATIVO]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'ACTIVE' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(makePaymentsResponse());

      const result = await reconciliarAssinaturas();

      expect(result).toEqual({ total: 1, atualizados: 1, erros: 0 });
      expect(mockAtualizarStatusAssinante).not.toHaveBeenCalled();
    });
  });

  describe('Asaas OVERDUE status', () => {
    it('updates assinante to inadimplente and blocks usuario when Asaas returns OVERDUE', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([ASSINANTE_ATIVO]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'OVERDUE' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(makePaymentsResponse());

      const result = await reconciliarAssinaturas();

      expect(result).toEqual({ total: 1, atualizados: 1, erros: 0 });
      expect(mockAtualizarStatusAssinante).toHaveBeenCalledWith(
        ASSINANTE_ATIVO.id,
        ASSINANTE_ATIVO.usuario_id,
        'inadimplente',
      );
    });
  });

  describe('Asaas CANCELLED status', () => {
    it('updates assinante to cancelado and unblocks usuario when Asaas returns CANCELLED', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([ASSINANTE_INADIMPLENTE]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'CANCELLED' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(makePaymentsResponse());

      const result = await reconciliarAssinaturas();

      expect(result).toEqual({ total: 1, atualizados: 1, erros: 0 });
      expect(mockAtualizarStatusAssinante).toHaveBeenCalledWith(
        ASSINANTE_INADIMPLENTE.id,
        ASSINANTE_INADIMPLENTE.usuario_id,
        'cancelado',
      );
    });

    it('updates assinante to cancelado when Asaas returns INACTIVE', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([ASSINANTE_ATIVO]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'INACTIVE' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(makePaymentsResponse());

      await reconciliarAssinaturas();

      expect(mockAtualizarStatusAssinante).toHaveBeenCalledWith(
        ASSINANTE_ATIVO.id,
        ASSINANTE_ATIVO.usuario_id,
        'cancelado',
      );
    });
  });

  describe('Error resilience', () => {
    it('logs error and continues processing other assinantes when one fails', async () => {
      const assinanteOk = { ...ASSINANTE_ATIVO, id: 'ok-uuid', usuario_id: 'ok-usuario' };
      const assinanteErr = { ...ASSINANTE_ATIVO, id: 'err-uuid', usuario_id: 'err-usuario', provider_subscription_id: 'sub_err' };

      mockPrisma.assinante.findMany.mockResolvedValue([assinanteErr, assinanteOk]);

      mockAsaas.getSubscription.mockImplementation((id) => {
        if (id === 'sub_err') throw new Error('Asaas network error');
        return Promise.resolve({ status: 'ACTIVE' });
      });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(makePaymentsResponse());

      const result = await reconciliarAssinaturas();

      expect(result).toEqual({ total: 2, atualizados: 1, erros: 1 });
    });
  });

  describe('Payment upsert (idempotência)', () => {
    it('creates payment when provider_payment_id does not exist', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([ASSINANTE_ATIVO]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'ACTIVE' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(
        makePaymentsResponse([
          { id: 'pay_001', status: 'CONFIRMED', value: 29.9, dueDate: '2026-04-01', paymentDate: '2026-03-15' },
        ]),
      );

      await reconciliarAssinaturas();

      expect(mockPrisma.assinantePagamento.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            provider_payment: {
              provider: 'asaas',
              provider_payment_id: 'pay_001',
            },
          },
          create: expect.objectContaining({
            provider_payment_id: 'pay_001',
            status: 'pago',
            assinante_id: ASSINANTE_ATIVO.id,
            usuario_id: ASSINANTE_ATIVO.usuario_id,
          }),
          update: expect.objectContaining({ status: 'pago' }),
        }),
      );
    });

    it('updates payment when provider_payment_id already exists', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([ASSINANTE_ATIVO]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'ACTIVE' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(
        makePaymentsResponse([
          { id: 'pay_001', status: 'CONFIRMED', value: 29.9, dueDate: '2026-04-01', paymentDate: '2026-03-15' },
        ]),
      );

      await reconciliarAssinaturas();

      expect(mockPrisma.assinantePagamento.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'pago' }),
        }),
      );
    });
  });

  describe('Summary return', () => {
    it('returns correct { total, atualizados, erros } summary', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([ASSINANTE_ATIVO, ASSINANTE_INADIMPLENTE]);
      mockAsaas.getSubscription.mockResolvedValue({ status: 'ACTIVE' });
      mockAsaas.getPaymentsBySubscription.mockResolvedValue(makePaymentsResponse());

      const result = await reconciliarAssinaturas();

      expect(result).toEqual({ total: 2, atualizados: 2, erros: 0 });
    });

    it('returns { total: 0, atualizados: 0, erros: 0 } when no active assinantes exist', async () => {
      mockPrisma.assinante.findMany.mockResolvedValue([]);

      const result = await reconciliarAssinaturas();

      expect(result).toEqual({ total: 0, atualizados: 0, erros: 0 });
    });
  });
});
