import { jest } from '@jest/globals';

// ============================================================
// Mocks
// ============================================================

const mockPrisma = {
  usuario: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockCreateMovimentacao = jest.fn();
const mockGetSaldoConsolidado = jest.fn();
jest.unstable_mockModule('../movimentacoesService.js', () => ({
  createMovimentacao: mockCreateMovimentacao,
  getSaldoConsolidado: mockGetSaldoConsolidado,
}));

const mockGetExtrato = jest.fn();
jest.unstable_mockModule('../extratoService.js', () => ({
  getExtrato: mockGetExtrato,
}));

const mockListContas = jest.fn();
jest.unstable_mockModule('../contaService.js', () => ({
  listContas: mockListContas,
}));

// ============================================================
// Module under test
// ============================================================

let resolverUsuarioPorWhatsapp;
let executarAcao;
let INTENT_CREATE_EXPENSE;
let INTENT_CREATE_INCOME;
let INTENT_GET_BALANCE;
let INTENT_GET_STATEMENT;

beforeAll(async () => {
  const agentMod = await import('../whatsappAgentService.js');
  resolverUsuarioPorWhatsapp = agentMod.resolverUsuarioPorWhatsapp;
  executarAcao = agentMod.executarAcao;

  const nlpMod = await import('../nlpService.js');
  INTENT_CREATE_EXPENSE = nlpMod.INTENT_CREATE_EXPENSE;
  INTENT_CREATE_INCOME = nlpMod.INTENT_CREATE_INCOME;
  INTENT_GET_BALANCE = nlpMod.INTENT_GET_BALANCE;
  INTENT_GET_STATEMENT = nlpMod.INTENT_GET_STATEMENT;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: exact-match returns null, findMany returns []
  mockPrisma.usuario.findFirst.mockResolvedValue(null);
  mockPrisma.usuario.findMany.mockResolvedValue([]);
});

// ============================================================
// resolverUsuarioPorWhatsapp
// ============================================================

describe('resolverUsuarioPorWhatsapp', () => {
  test('encontra usuário com número exato', async () => {
    const usuario = { id: 'user-1', whatsapp: '5511999999999', status: 'ativo', deleted_at: null };
    mockPrisma.usuario.findFirst.mockResolvedValue(usuario);

    const result = await resolverUsuarioPorWhatsapp('5511999999999');

    expect(result).toEqual(usuario);
    expect(mockPrisma.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ whatsapp: '5511999999999' }) }),
    );
  });

  test('encontra usuário com número formatado diferente (normalização)', async () => {
    // Exact match returns null — triggers slow path
    mockPrisma.usuario.findFirst.mockResolvedValue(null);

    const usuario = { id: 'user-2', whatsapp: '+55 11 99999-9999', status: 'ativo', deleted_at: null };
    mockPrisma.usuario.findMany.mockResolvedValue([usuario]);

    const result = await resolverUsuarioPorWhatsapp('5511999999999');

    expect(result).toEqual(usuario);
  });

  test('retorna null quando não encontrado', async () => {
    mockPrisma.usuario.findFirst.mockResolvedValue(null);
    mockPrisma.usuario.findMany.mockResolvedValue([
      { id: 'user-3', whatsapp: '+55 21 98888-8888', status: 'ativo', deleted_at: null },
    ]);

    const result = await resolverUsuarioPorWhatsapp('5511999999999');

    expect(result).toBeNull();
  });
});

// ============================================================
// executarAcao — CREATE_EXPENSE
// ============================================================

describe('executarAcao — CREATE_EXPENSE', () => {
  const usuario = { id: 'user-1', nome: 'João' };
  const conta = { id: 'conta-1', nome: 'Conta Corrente' };

  test('cria movimentação de saída e retorna resposta formatada', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-1', valor: 50, tipo: 'saida' });

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 50, descricao: 'almoço' });

    expect(mockListContas).toHaveBeenCalledWith('user-1');
    expect(mockCreateMovimentacao).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ conta_id: 'conta-1', tipo: 'saida', valor: 50, descricao: 'almoço' }),
    );
    expect(resposta).toContain('✅ Despesa registrada!');
    expect(resposta).toContain('R$ 50,00');
    expect(resposta).toContain('almoço');
    expect(resposta).toContain('Conta Corrente');
  });

  test('retorna erro quando não há conta cadastrada', async () => {
    mockListContas.mockResolvedValue([]);

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 50, descricao: 'almoço' });

    expect(resposta).toContain('❌ Você não tem nenhuma conta cadastrada');
    expect(mockCreateMovimentacao).not.toHaveBeenCalled();
  });

  test('usa descrição padrão quando descricao está vazia', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-1', valor: 30, tipo: 'saida' });

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 30, descricao: '' });

    expect(mockCreateMovimentacao).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ descricao: 'Despesa via WhatsApp' }),
    );
    expect(resposta).toContain('Despesa via WhatsApp');
  });
});

// ============================================================
// executarAcao — CREATE_INCOME
// ============================================================

describe('executarAcao — CREATE_INCOME', () => {
  const usuario = { id: 'user-1', nome: 'João' };
  const conta = { id: 'conta-1', nome: 'Poupança' };

  test('cria movimentação de entrada e retorna resposta formatada', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-2', valor: 2000, tipo: 'entrada' });

    const resposta = await executarAcao(usuario, INTENT_CREATE_INCOME, { valor: 2000, descricao: 'cliente X' });

    expect(mockCreateMovimentacao).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ conta_id: 'conta-1', tipo: 'entrada', valor: 2000, descricao: 'cliente X' }),
    );
    expect(resposta).toContain('✅ Receita registrada!');
    expect(resposta).toContain('R$ 2.000,00');
    expect(resposta).toContain('cliente X');
    expect(resposta).toContain('Poupança');
  });
});

// ============================================================
// executarAcao — GET_BALANCE
// ============================================================

describe('executarAcao — GET_BALANCE', () => {
  const usuario = { id: 'user-1' };

  test('retorna saldo consolidado formatado em padrão BR', async () => {
    mockGetSaldoConsolidado.mockResolvedValue({ saldo: 1234.56, entradas: 5000, saidas: 3765.44 });

    const resposta = await executarAcao(usuario, INTENT_GET_BALANCE, {});

    expect(mockGetSaldoConsolidado).toHaveBeenCalledWith('user-1');
    expect(resposta).toContain('💰 Seu saldo atual');
    expect(resposta).toContain('R$ 1.234,56');
    expect(resposta).toContain('R$ 5.000,00');
    expect(resposta).toContain('R$ 3.765,44');
  });
});

// ============================================================
// executarAcao — GET_STATEMENT
// ============================================================

describe('executarAcao — GET_STATEMENT', () => {
  const usuario = { id: 'user-1' };

  test('retorna extrato com itens formatados', async () => {
    mockGetExtrato.mockResolvedValue({
      items: [
        { type: 'OUT', description: 'Almoço', amount: 50 },
        { type: 'IN', description: 'Freela', amount: 500 },
      ],
      totals: { totalIn: 500, totalOut: 50 },
    });

    const resposta = await executarAcao(usuario, INTENT_GET_STATEMENT, { periodo: 'semana' });

    expect(mockGetExtrato).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ perPage: 5 }),
    );
    expect(resposta).toContain('📊 Extrato semana');
    expect(resposta).toContain('🔴 Almoço');
    expect(resposta).toContain('💚 Freela');
    expect(resposta).toContain('R$ 500,00');
    expect(resposta).toContain('Total de entradas');
  });

  test('retorna mensagem vazia quando sem movimentações', async () => {
    mockGetExtrato.mockResolvedValue({
      items: [],
      totals: { totalIn: 0, totalOut: 0 },
    });

    const resposta = await executarAcao(usuario, INTENT_GET_STATEMENT, { periodo: 'mes' });

    expect(resposta).toBe('📊 Nenhuma movimentação encontrada no período.');
  });

  test('usa mês como padrão quando período está vazio', async () => {
    mockGetExtrato.mockResolvedValue({
      items: [{ type: 'IN', description: 'Salário', amount: 3000 }],
      totals: { totalIn: 3000, totalOut: 0 },
    });

    const resposta = await executarAcao(usuario, INTENT_GET_STATEMENT, { periodo: '' });

    expect(resposta).toContain('📊 Extrato mês');
  });
});

// ============================================================
// executarAcao — Error handling
// ============================================================

describe('executarAcao — tratamento de erros', () => {
  const usuario = { id: 'user-1' };

  test('captura erro e retorna mensagem amigável', async () => {
    mockListContas.mockRejectedValue(new Error('DB connection failed'));

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 100, descricao: 'teste' });

    expect(resposta).toBe('❌ Ocorreu um erro ao processar sua solicitação. Tente novamente.');
  });
});
