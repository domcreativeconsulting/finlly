import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  cupom: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  assinante: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  usuario: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockAsaas = {
  getCustomerByEmail: jest.fn(),
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockGetRedisClient = jest.fn();

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

jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  getRedisClient: mockGetRedisClient,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { BILLING_STATUS_CACHE_TTL: 60 },
}));

// ---------------------------------------------------------------------------
// Service under test
// ---------------------------------------------------------------------------
let criarAssinatura;
let cancelarAssinatura;
let getStatusAssinatura;

beforeAll(async () => {
  const mod = await import('../billingService.js');
  criarAssinatura = mod.criarAssinatura;
  cancelarAssinatura = mod.cancelarAssinatura;
  getStatusAssinatura = mod.getStatusAssinatura;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRedisClient.mockResolvedValue(mockRedis);
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue('OK');
  mockRedis.del.mockResolvedValue(1);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USUARIO_ID = 'usuario-uuid-001';
const USUARIO = {
  id: USUARIO_ID,
  nome: 'João Silva',
  email: 'joao@example.com',
  telefone: null,
};

const CUSTOMER = { id: 'cus_asaas_001', name: 'João Silva', email: 'joao@example.com' };
const SUBSCRIPTION = { id: 'sub_asaas_001', invoiceUrl: 'https://asaas.com/pay/123' };
const ASSINANTE = {
  id: 'assinante-uuid-001',
  usuario_id: USUARIO_ID,
  status: 'inativo',
  plano: 'mensal',
  provider: 'asaas',
  provider_customer_id: CUSTOMER.id,
  provider_subscription_id: SUBSCRIPTION.id,
};

// ---------------------------------------------------------------------------
// criarAssinatura
// ---------------------------------------------------------------------------

describe('criarAssinatura', () => {
  test('cria assinatura mensal sem cupom', async () => {
    mockPrisma.usuario.findFirst.mockResolvedValue(USUARIO);
    mockAsaas.getCustomerByEmail.mockResolvedValue(CUSTOMER);
    mockAsaas.createSubscription.mockResolvedValue(SUBSCRIPTION);
    mockPrisma.assinante.upsert.mockResolvedValue(ASSINANTE);

    const result = await criarAssinatura(USUARIO_ID, { plano: 'mensal', ciclo: 'mensal', formaPagamento: 'PIX' });

    expect(result).toMatchObject({
      assinante: ASSINANTE,
      paymentLink: SUBSCRIPTION.invoiceUrl,
    });

    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: CUSTOMER.id,
        cycle: 'MONTHLY',
        value: 29.9,
        billingType: 'PIX',
      }),
    );
  });

  test('cria assinatura anual com ciclo anual', async () => {
    mockPrisma.usuario.findFirst.mockResolvedValue(USUARIO);
    mockAsaas.getCustomerByEmail.mockResolvedValue(CUSTOMER);
    mockAsaas.createSubscription.mockResolvedValue({ id: 'sub_002', invoiceUrl: null });
    mockPrisma.assinante.upsert.mockResolvedValue({ ...ASSINANTE, plano: 'anual' });

    const result = await criarAssinatura(USUARIO_ID, { plano: 'anual', ciclo: 'anual', formaPagamento: 'CREDIT_CARD' });

    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ cycle: 'YEARLY', value: 287.9, billingType: 'CREDIT_CARD' }),
    );
    expect(result.paymentLink).toBeNull();
  });

  test('cria novo customer quando não encontrado no Asaas', async () => {
    mockPrisma.usuario.findFirst.mockResolvedValue(USUARIO);
    mockAsaas.getCustomerByEmail.mockResolvedValue(null);
    mockAsaas.createCustomer.mockResolvedValue(CUSTOMER);
    mockAsaas.createSubscription.mockResolvedValue(SUBSCRIPTION);
    mockPrisma.assinante.upsert.mockResolvedValue(ASSINANTE);

    await criarAssinatura(USUARIO_ID, { plano: 'mensal', ciclo: 'mensal', formaPagamento: 'PIX' });

    expect(mockAsaas.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ email: USUARIO.email, nome: USUARIO.nome }),
    );
  });

  test('rejeita ciclo inválido com AppError 400', async () => {
    await expect(
      criarAssinatura(USUARIO_ID, { plano: 'mensal', ciclo: 'semanal', formaPagamento: 'PIX' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  test('lança AppError 404 se usuário não encontrado', async () => {
    mockPrisma.usuario.findFirst.mockResolvedValue(null);

    await expect(
      criarAssinatura(USUARIO_ID, { plano: 'mensal', ciclo: 'mensal', formaPagamento: 'PIX' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('aplica desconto percentual do cupom', async () => {
    const CUPOM = {
      id: 'cupom-001',
      codigo: 'DESC10',
      desconto_percentual: '10',
      desconto_fixo: null,
      uso_maximo: 100,
      uso_atual: 0,
      valido_ate: null,
      ativo: true,
    };
    mockPrisma.usuario.findFirst.mockResolvedValue(USUARIO);
    mockPrisma.cupom.findFirst.mockResolvedValue(CUPOM);
    mockPrisma.cupom.update.mockResolvedValue({ ...CUPOM, uso_atual: 1 });
    mockAsaas.getCustomerByEmail.mockResolvedValue(CUSTOMER);
    mockAsaas.createSubscription.mockResolvedValue(SUBSCRIPTION);
    mockPrisma.assinante.upsert.mockResolvedValue(ASSINANTE);

    await criarAssinatura(USUARIO_ID, { plano: 'mensal', ciclo: 'mensal', formaPagamento: 'PIX', cupomCodigo: 'DESC10' });

    // 29.90 - 10% = 26.91
    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ value: 26.91 }),
    );
  });

  test('rejeita cupom inválido com AppError 400', async () => {
    mockPrisma.usuario.findFirst.mockResolvedValue(USUARIO);
    mockPrisma.cupom.findFirst.mockResolvedValue(null);

    await expect(
      criarAssinatura(USUARIO_ID, { plano: 'mensal', ciclo: 'mensal', formaPagamento: 'PIX', cupomCodigo: 'INVALIDO' }),
    ).rejects.toMatchObject({ status: 400, message: 'Cupom inválido ou expirado' });
  });

  test('envia billingType PIX quando formaPagamento é PIX', async () => {
    mockPrisma.usuario.findFirst.mockResolvedValue(USUARIO);
    mockAsaas.getCustomerByEmail.mockResolvedValue(CUSTOMER);
    mockAsaas.createSubscription.mockResolvedValue(SUBSCRIPTION);
    mockPrisma.assinante.upsert.mockResolvedValue(ASSINANTE);

    await criarAssinatura(USUARIO_ID, { plano: 'mensal', ciclo: 'mensal', formaPagamento: 'PIX' });

    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ billingType: 'PIX' }),
    );
  });

  test('envia billingType CREDIT_CARD quando formaPagamento é CREDIT_CARD', async () => {
    mockPrisma.usuario.findFirst.mockResolvedValue(USUARIO);
    mockAsaas.getCustomerByEmail.mockResolvedValue(CUSTOMER);
    mockAsaas.createSubscription.mockResolvedValue(SUBSCRIPTION);
    mockPrisma.assinante.upsert.mockResolvedValue(ASSINANTE);

    await criarAssinatura(USUARIO_ID, { plano: 'mensal', ciclo: 'mensal', formaPagamento: 'CREDIT_CARD' });

    expect(mockAsaas.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ billingType: 'CREDIT_CARD' }),
    );
  });
});

// ---------------------------------------------------------------------------
// cancelarAssinatura
// ---------------------------------------------------------------------------

describe('cancelarAssinatura', () => {
  test('cancela assinatura ativa com sucesso', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    mockAsaas.cancelSubscription.mockResolvedValue(null);
    mockPrisma.assinante.update.mockResolvedValue({ ...ASSINANTE, status: 'cancelado' });
    mockPrisma.usuario.update.mockResolvedValue({});

    await cancelarAssinatura(USUARIO_ID);

    expect(mockPrisma.assinante.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelado' }) }),
    );
    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ativo' } }),
    );
  });

  test('lança AppError 400 se não há assinatura ativa', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(null);

    await expect(cancelarAssinatura(USUARIO_ID)).rejects.toMatchObject({
      status: 400,
      message: 'Nenhuma assinatura ativa encontrada',
    });
  });

  test('lança AppError 400 se assinatura já cancelada', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue({ ...ASSINANTE, status: 'cancelado' });

    await expect(cancelarAssinatura(USUARIO_ID)).rejects.toMatchObject({
      status: 400,
      message: 'Assinatura já cancelada',
    });
  });

  test('prossegue cancelamento local mesmo se Asaas falhar', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    mockAsaas.cancelSubscription.mockRejectedValue(new Error('Asaas error'));
    mockPrisma.assinante.update.mockResolvedValue({ ...ASSINANTE, status: 'cancelado' });
    mockPrisma.usuario.update.mockResolvedValue({});

    await cancelarAssinatura(USUARIO_ID);

    expect(mockPrisma.assinante.update).toHaveBeenCalled();
    expect(mockPrisma.usuario.update).toHaveBeenCalled();
  });

  test('invalida o cache Redis após cancelamento bem-sucedido', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    mockAsaas.cancelSubscription.mockResolvedValue(null);
    mockPrisma.assinante.update.mockResolvedValue({ ...ASSINANTE, status: 'cancelado' });
    mockPrisma.usuario.update.mockResolvedValue({});

    await cancelarAssinatura(USUARIO_ID);

    expect(mockRedis.del).toHaveBeenCalledWith(`billing:status:${USUARIO_ID}`);
  });

  test('prossegue cancelamento mesmo se Redis estiver indisponível', async () => {
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);
    mockAsaas.cancelSubscription.mockResolvedValue(null);
    mockPrisma.assinante.update.mockResolvedValue({ ...ASSINANTE, status: 'cancelado' });
    mockPrisma.usuario.update.mockResolvedValue({});
    mockGetRedisClient.mockRejectedValueOnce(new Error('Redis down'));

    await cancelarAssinatura(USUARIO_ID);

    expect(mockPrisma.assinante.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getStatusAssinatura
// ---------------------------------------------------------------------------

describe('getStatusAssinatura', () => {
  test('retorna do cache quando há cache hit', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify(ASSINANTE));

    const result = await getStatusAssinatura(USUARIO_ID);

    expect(result).toEqual(ASSINANTE);
    expect(mockPrisma.assinante.findFirst).not.toHaveBeenCalled();
    expect(mockRedis.get).toHaveBeenCalledWith(`billing:status:${USUARIO_ID}`);
  });

  test('consulta o DB e salva no cache quando há cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);

    const result = await getStatusAssinatura(USUARIO_ID);

    expect(result).toEqual(ASSINANTE);
    expect(mockPrisma.assinante.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuario_id: USUARIO_ID, deleted_at: null } }),
    );
    expect(mockRedis.set).toHaveBeenCalledWith(
      `billing:status:${USUARIO_ID}`,
      JSON.stringify(ASSINANTE),
      { EX: 60 },
    );
  });

  test('retorna null quando não existir assinante (cache miss)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.assinante.findFirst.mockResolvedValue(null);

    const result = await getStatusAssinatura(USUARIO_ID);

    expect(result).toBeNull();
    expect(mockRedis.set).toHaveBeenCalledWith(
      `billing:status:${USUARIO_ID}`,
      JSON.stringify(null),
      { EX: 60 },
    );
  });

  test('funciona normalmente quando Redis está indisponível (fallback para DB)', async () => {
    mockGetRedisClient.mockRejectedValue(new Error('Redis down'));
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);

    const result = await getStatusAssinatura(USUARIO_ID);

    expect(result).toEqual(ASSINANTE);
    expect(mockPrisma.assinante.findFirst).toHaveBeenCalled();
  });

  test('retorna assinante quando existir (compatibilidade com comportamento original)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.assinante.findFirst.mockResolvedValue(ASSINANTE);

    const result = await getStatusAssinatura(USUARIO_ID);

    expect(result).toEqual(ASSINANTE);
  });
});
