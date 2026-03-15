import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAsaas = {
  getCustomerByEmail: jest.fn(),
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
};

const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  cupom: {
    findFirst: jest.fn(),
  },
  assinante: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  assinantePagamento: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../lib/asaas/asaasClient.js', () => ({
  asaas: mockAsaas,
  default: mockAsaas,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    ASAAS_API_KEY: 'test-key',
    ASAAS_BASE_URL: 'https://sandbox.asaas.com/api/v3',
  },
}));

// ---------------------------------------------------------------------------
// Service under test
// ---------------------------------------------------------------------------

let criarAssinatura;
let cancelarAssinatura;

beforeAll(async () => {
  const mod = await import('../billingService.js');
  criarAssinatura = mod.criarAssinatura;
  cancelarAssinatura = mod.cancelarAssinatura;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
});

// ---------------------------------------------------------------------------
// criarAssinatura
// ---------------------------------------------------------------------------

describe('criarAssinatura', () => {
  const mockUsuario = {
    id: 'user-uuid-1',
    nome: 'João Silva',
    email: 'joao@example.com',
    telefone: '11999999999',
  };

  const mockAsaasCustomer = { id: 'cus_001' };
  const mockAsaasSubscription = {
    id: 'sub_001',
    invoiceUrl: 'https://asaas.com/invoice/1',
  };

  const mockAssinante = {
    id: 'assinante-1',
    usuario_id: 'user-uuid-1',
    status: 'pendente',
    plano: 'mensal',
    provider: 'asaas',
    provider_customer_id: 'cus_001',
    provider_subscription_id: 'sub_001',
  };

  test('creates monthly subscription successfully', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(mockUsuario);
    mockAsaas.getCustomerByEmail.mockResolvedValue(mockAsaasCustomer);
    mockAsaas.createSubscription.mockResolvedValue(mockAsaasSubscription);
    mockPrisma.assinante.upsert.mockResolvedValue(mockAssinante);

    const result = await criarAssinatura('user-uuid-1', { plano: 'mensal', ciclo: 'mensal' });

    expect(result.assinante).toEqual(mockAssinante);
    expect(result.paymentLink).toBe('https://asaas.com/invoice/1');

    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_001',
        billingType: 'BOLETO',
        cycle: 'MONTHLY',
        value: 29.90,
        externalReference: 'user-uuid-1',
      }),
    );

    expect(mockPrisma.assinante.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario_id: 'user-uuid-1' },
        update: expect.objectContaining({ status: 'pendente', plano: 'mensal' }),
        create: expect.objectContaining({ status: 'pendente', plano: 'mensal' }),
      }),
    );
  });

  test('creates annual subscription with correct value', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(mockUsuario);
    mockAsaas.getCustomerByEmail.mockResolvedValue(mockAsaasCustomer);
    mockAsaas.createSubscription.mockResolvedValue({ id: 'sub_002' });
    mockPrisma.assinante.upsert.mockResolvedValue({ ...mockAssinante, plano: 'anual' });

    await criarAssinatura('user-uuid-1', { plano: 'anual', ciclo: 'anual' });

    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        cycle: 'YEARLY',
        value: 287.90,
      }),
    );
  });

  test('creates Asaas customer if not found by email', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(mockUsuario);
    mockAsaas.getCustomerByEmail.mockResolvedValue(null); // not found
    mockAsaas.createCustomer.mockResolvedValue(mockAsaasCustomer);
    mockAsaas.createSubscription.mockResolvedValue(mockAsaasSubscription);
    mockPrisma.assinante.upsert.mockResolvedValue(mockAssinante);

    await criarAssinatura('user-uuid-1', { plano: 'mensal', ciclo: 'mensal' });

    expect(mockAsaas.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'João Silva',
        email: 'joao@example.com',
      }),
    );
  });

  test('throws notFound if user does not exist', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      criarAssinatura('nonexistent-id', { plano: 'mensal', ciclo: 'mensal' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  test('throws badRequest for invalid ciclo', async () => {
    await expect(
      criarAssinatura('user-uuid-1', { plano: 'mensal', ciclo: 'semanal' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });

  test('applies percentage coupon discount', async () => {
    const mockCupom = {
      id: 'cupom-1',
      codigo: 'DESCONTO10',
      ativo: true,
      valido_ate: null,
      uso_maximo: null,
      uso_atual: 0,
      desconto_percentual: '10.00',
      desconto_fixo: null,
    };

    mockPrisma.usuario.findUnique.mockResolvedValue(mockUsuario);
    mockPrisma.cupom.findFirst.mockResolvedValue(mockCupom);
    mockAsaas.getCustomerByEmail.mockResolvedValue(mockAsaasCustomer);
    mockAsaas.createSubscription.mockResolvedValue(mockAsaasSubscription);
    mockPrisma.assinante.upsert.mockResolvedValue(mockAssinante);

    await criarAssinatura('user-uuid-1', { plano: 'mensal', ciclo: 'mensal', cupomCodigo: 'DESCONTO10' });

    // 29.90 - 10% = 26.91
    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 26.91,
      }),
    );
  });

  test('applies fixed coupon discount', async () => {
    const mockCupom = {
      id: 'cupom-2',
      codigo: 'DESCONTO5',
      ativo: true,
      valido_ate: null,
      uso_maximo: null,
      uso_atual: 0,
      desconto_percentual: null,
      desconto_fixo: '5.00',
    };

    mockPrisma.usuario.findUnique.mockResolvedValue(mockUsuario);
    mockPrisma.cupom.findFirst.mockResolvedValue(mockCupom);
    mockAsaas.getCustomerByEmail.mockResolvedValue(mockAsaasCustomer);
    mockAsaas.createSubscription.mockResolvedValue(mockAsaasSubscription);
    mockPrisma.assinante.upsert.mockResolvedValue(mockAssinante);

    await criarAssinatura('user-uuid-1', { plano: 'mensal', ciclo: 'mensal', cupomCodigo: 'DESCONTO5' });

    // 29.90 - 5.00 = 24.90
    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 24.90,
      }),
    );
  });

  test('throws badRequest for invalid coupon', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(mockUsuario);
    mockPrisma.cupom.findFirst.mockResolvedValue(null);

    await expect(
      criarAssinatura('user-uuid-1', { plano: 'mensal', ciclo: 'mensal', cupomCodigo: 'INVALIDO' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });
});

// ---------------------------------------------------------------------------
// cancelarAssinatura
// ---------------------------------------------------------------------------

describe('cancelarAssinatura', () => {
  test('throws badRequest if no active subscription found', async () => {
    mockPrisma.assinante.findUnique.mockResolvedValue(null);

    await expect(
      cancelarAssinatura('user-uuid-1'),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });

  test('throws badRequest if subscription is already cancelled', async () => {
    mockPrisma.assinante.findUnique.mockResolvedValue({
      id: 'assinante-1',
      status: 'cancelado',
      provider_subscription_id: 'sub_001',
    });

    await expect(
      cancelarAssinatura('user-uuid-1'),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });
  });

  test('cancels subscription successfully', async () => {
    mockPrisma.assinante.findUnique.mockResolvedValue({
      id: 'assinante-1',
      usuario_id: 'user-uuid-1',
      status: 'ativo',
      provider_subscription_id: 'sub_001',
    });

    mockAsaas.cancelSubscription.mockResolvedValue({});
    mockPrisma.assinante.update.mockResolvedValue({});
    mockPrisma.usuario.update.mockResolvedValue({});

    await cancelarAssinatura('user-uuid-1');

    expect(mockAsaas.cancelSubscription).toHaveBeenCalledWith('sub_001');

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'cancelado' }),
      }),
    );

    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-uuid-1' },
        data: expect.objectContaining({ status: 'ativo' }),
      }),
    );
  });

  test('continues cancellation even if Asaas API fails', async () => {
    mockPrisma.assinante.findUnique.mockResolvedValue({
      id: 'assinante-1',
      usuario_id: 'user-uuid-1',
      status: 'ativo',
      provider_subscription_id: 'sub_001',
    });

    mockAsaas.cancelSubscription.mockRejectedValue(new Error('Asaas API error'));
    mockPrisma.assinante.update.mockResolvedValue({});
    mockPrisma.usuario.update.mockResolvedValue({});

    // Should not throw — Asaas error is swallowed
    await expect(cancelarAssinatura('user-uuid-1')).resolves.not.toThrow();

    expect(mockPrisma.assinante.update).toHaveBeenCalled();
  });
});
