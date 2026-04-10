import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  contaPagar: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  movimentacaoCaixa: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRegistrarEvento = jest.fn();

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../auditoria.service.js', () => ({
  registrarEvento: mockRegistrarEvento,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Service under test
// ---------------------------------------------------------------------------
let deleteContaPagar;
let updateContaPagar;
let cancelarContaPagar;
let pagarContaPagar;
let createContaPagar;
let listContasPagar;

beforeAll(async () => {
  const mod = await import('../contasPagarService.js');
  deleteContaPagar = mod.deleteContaPagar;
  updateContaPagar = mod.updateContaPagar;
  cancelarContaPagar = mod.cancelarContaPagar;
  pagarContaPagar = mod.pagarContaPagar;
  createContaPagar = mod.createContaPagar;
  listContasPagar = mod.listContasPagar;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRegistrarEvento.mockResolvedValue(undefined);

  // Default $transaction: execute the callback with mockPrisma as tx
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-uuid-001';
const CONTA_ID = 'conta-uuid-001';
const CONTA_BANCARIA_ID = 'conta-bancaria-uuid-001';

const buildContaPendente = (overrides = {}) => ({
  id: CONTA_ID,
  usuario_id: USER_ID,
  status: 'pendente',
  descricao: 'Conta de luz',
  valor: 150,
  conta_id: null,
  categoria_id: null,
  deleted_at: null,
  ...overrides,
});

const buildContaAtualizada = (overrides = {}) => ({
  ...buildContaPendente(),
  categoria: null,
  conta: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// deleteContaPagar
// ---------------------------------------------------------------------------

describe('deleteContaPagar', () => {
  test('lança AppError 400 quando conta tem status pago', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente({ status: 'pago' }));

    await expect(deleteContaPagar(CONTA_ID, USER_ID)).rejects.toMatchObject({
      status: 400,
      message: 'Não é possível excluir uma conta já paga',
    });
  });

  test('realiza soft-delete com sucesso quando conta está pendente', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente());
    mockPrisma.contaPagar.update.mockResolvedValue({});

    await expect(deleteContaPagar(CONTA_ID, USER_ID)).resolves.toBeUndefined();
    expect(mockPrisma.contaPagar.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONTA_ID }, data: expect.objectContaining({ deleted_at: expect.any(Date) }) }),
    );
  });

  test('lança AppError 404 quando conta não é encontrada', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(null);

    await expect(deleteContaPagar(CONTA_ID, USER_ID)).rejects.toMatchObject({ status: 404 });
  });

  test('lança AppError 404 quando conta pertence a outro usuário', async () => {
    // findFirst with usuario_id filter returns null for another user's account
    mockPrisma.contaPagar.findFirst.mockResolvedValue(null);

    await expect(deleteContaPagar(CONTA_ID, 'outro-user-id')).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// updateContaPagar
// ---------------------------------------------------------------------------

describe('updateContaPagar', () => {
  test('lança AppError 400 quando conta tem status pago', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente({ status: 'pago' }));

    await expect(
      updateContaPagar(CONTA_ID, USER_ID, { descricao: 'Novo nome' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Não é possível editar uma conta já paga',
    });
  });

  test('atualiza com sucesso quando conta está pendente', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente());
    const contaAtualizada = buildContaAtualizada({ descricao: 'Novo nome' });
    mockPrisma.contaPagar.update.mockResolvedValue(contaAtualizada);

    const result = await updateContaPagar(CONTA_ID, USER_ID, { descricao: 'Novo nome' });

    expect(result).toMatchObject({ descricao: 'Novo nome' });
    expect(mockPrisma.contaPagar.update).toHaveBeenCalled();
  });

  test('lança AppError 404 quando conta não é encontrada', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(null);

    await expect(
      updateContaPagar(CONTA_ID, USER_ID, { descricao: 'X' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// cancelarContaPagar
// ---------------------------------------------------------------------------

describe('cancelarContaPagar', () => {
  test('lança AppError 400 quando conta tem status pago', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente({ status: 'pago' }));

    await expect(cancelarContaPagar(CONTA_ID, USER_ID)).rejects.toMatchObject({
      status: 400,
      message: 'Não é possível cancelar uma conta já paga',
    });
  });

  test('lança AppError 400 quando conta já está cancelada', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente({ status: 'cancelado' }));

    await expect(cancelarContaPagar(CONTA_ID, USER_ID)).rejects.toMatchObject({
      status: 400,
      message: 'Conta a pagar já está cancelada',
    });
  });

  test('cancela com sucesso quando conta está pendente', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente());
    const contaCancelada = buildContaAtualizada({ status: 'cancelado' });
    mockPrisma.contaPagar.update.mockResolvedValue(contaCancelada);

    const result = await cancelarContaPagar(CONTA_ID, USER_ID);

    expect(result).toMatchObject({ status: 'cancelado' });
  });

  test('lança AppError 404 quando conta não é encontrada', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(null);

    await expect(cancelarContaPagar(CONTA_ID, USER_ID)).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// pagarContaPagar
// ---------------------------------------------------------------------------

describe('pagarContaPagar', () => {
  test('lança AppError 400 quando conta já está paga', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente({ status: 'pago' }));

    await expect(pagarContaPagar(CONTA_ID, USER_ID, {})).rejects.toMatchObject({
      status: 400,
      message: 'Conta a pagar já está paga',
    });
  });

  test('paga sem criar movimentação quando não há conta_id', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(buildContaPendente({ conta_id: null }));
    const contaPaga = buildContaAtualizada({ status: 'pago' });
    mockPrisma.contaPagar.update.mockResolvedValue(contaPaga);

    const result = await pagarContaPagar(CONTA_ID, USER_ID, {});

    expect(result).toMatchObject({ status: 'pago' });
    expect(mockPrisma.movimentacaoCaixa.create).not.toHaveBeenCalled();
  });

  test('paga e cria MovimentacaoCaixa de saída quando há conta_id', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(
      buildContaPendente({ conta_id: CONTA_BANCARIA_ID }),
    );
    const contaPaga = buildContaAtualizada({ status: 'pago', conta_id: CONTA_BANCARIA_ID });
    mockPrisma.contaPagar.update.mockResolvedValue(contaPaga);
    mockPrisma.movimentacaoCaixa.create.mockResolvedValue({ id: 'mov-uuid-001' });

    const result = await pagarContaPagar(CONTA_ID, USER_ID, {});

    expect(result).toMatchObject({ status: 'pago' });
    expect(mockPrisma.movimentacaoCaixa.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'saida', conta_id: CONTA_BANCARIA_ID }),
      }),
    );
  });

  test('lança AppError 404 quando conta não é encontrada', async () => {
    mockPrisma.contaPagar.findFirst.mockResolvedValue(null);

    await expect(pagarContaPagar(CONTA_ID, USER_ID, {})).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------------------
// createContaPagar
// ---------------------------------------------------------------------------

describe('createContaPagar', () => {
  test('cria conta única quando total_parcelas não é fornecido', async () => {
    const contaCriada = buildContaAtualizada({
      id: 'nova-conta-uuid',
      descricao: 'Internet',
      valor: 100,
    });
    mockPrisma.contaPagar.create.mockResolvedValue(contaCriada);

    const result = await createContaPagar(USER_ID, {
      descricao: 'Internet',
      valor: 100,
      data_vencimento: '2026-05-01',
    });

    expect(result).toMatchObject({ descricao: 'Internet', valor: 100 });
    expect(mockPrisma.contaPagar.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.contaPagar.createMany).not.toHaveBeenCalled();
  });

  test('cria 3 parcelas mensais quando total_parcelas: 3 e recorrencia: mensal', async () => {
    mockPrisma.contaPagar.createMany.mockResolvedValue({ count: 3 });
    const primeiraParcelaMock = buildContaAtualizada({
      id: 'parcela-uuid-001',
      descricao: 'Financiamento',
      valor: 500,
      parcela_atual: 1,
      total_parcelas: 3,
    });
    mockPrisma.contaPagar.findFirst.mockResolvedValue(primeiraParcelaMock);

    const result = await createContaPagar(USER_ID, {
      descricao: 'Financiamento',
      valor: 500,
      data_vencimento: '2026-05-01',
      total_parcelas: 3,
      recorrencia: 'mensal',
    });

    expect(result).toMatchObject({ parcelas: 3, grupo_recorrencia_id: expect.any(String) });
    expect(mockPrisma.contaPagar.createMany).toHaveBeenCalledTimes(1);
    // Verify 3 parcelas were passed to createMany
    const createManyCall = mockPrisma.contaPagar.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// listContasPagar
// ---------------------------------------------------------------------------

describe('listContasPagar', () => {
  test('retorna lista paginada com data, total, page, totalPages e nextCursor', async () => {
    const contas = [
      buildContaAtualizada({ id: 'conta-1', valor: 50 }),
      buildContaAtualizada({ id: 'conta-2', valor: 80 }),
    ];
    mockPrisma.contaPagar.findMany.mockResolvedValue(contas);
    mockPrisma.contaPagar.count.mockResolvedValue(2);

    const result = await listContasPagar(USER_ID, {});

    expect(result).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ id: 'conta-1' }),
        expect.objectContaining({ id: 'conta-2' }),
      ]),
      total: 2,
      page: 1,
      totalPages: 1,
      nextCursor: null,
    });
  });
});
