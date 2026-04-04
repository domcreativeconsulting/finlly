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

const mockCreateContaPagar = jest.fn();
const mockListContasPagar = jest.fn();
const mockPagarContaPagar = jest.fn();
jest.unstable_mockModule('../contasPagarService.js', () => ({
  createContaPagar: mockCreateContaPagar,
  listContasPagar: mockListContasPagar,
  pagarContaPagar: mockPagarContaPagar,
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
let INTENT_CREATE_BILL;
let INTENT_PAY_BILL;
let INTENT_CREATE_INVESTMENT;

beforeAll(async () => {
  const agentMod = await import('../whatsappAgentService.js');
  resolverUsuarioPorWhatsapp = agentMod.resolverUsuarioPorWhatsapp;
  executarAcao = agentMod.executarAcao;

  const nlpMod = await import('../nlpService.js');
  INTENT_CREATE_EXPENSE = nlpMod.INTENT_CREATE_EXPENSE;
  INTENT_CREATE_INCOME = nlpMod.INTENT_CREATE_INCOME;
  INTENT_GET_BALANCE = nlpMod.INTENT_GET_BALANCE;
  INTENT_GET_STATEMENT = nlpMod.INTENT_GET_STATEMENT;
  INTENT_CREATE_BILL = nlpMod.INTENT_CREATE_BILL;
  INTENT_PAY_BILL = nlpMod.INTENT_PAY_BILL;
  INTENT_CREATE_INVESTMENT = nlpMod.INTENT_CREATE_INVESTMENT;
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

  test('cria movimentação de saída e retorna resposta formatada com nome do usuário', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-1', valor: 50, tipo: 'saida' });
    mockGetSaldoConsolidado.mockResolvedValue({ saldo: 500, entradas: 3000, saidas: 2500 });
    mockGetExtrato.mockResolvedValue({ items: [], totals: { totalIn: 0, totalOut: 320 } });

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 50, descricao: 'almoço' });

    expect(mockListContas).toHaveBeenCalledWith('user-1');
    expect(mockCreateMovimentacao).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ conta_id: 'conta-1', tipo: 'saida', valor: 50, descricao: 'almoço' }),
    );
    expect(resposta).toContain('✅ Despesa registrada, João!');
    expect(resposta).toContain('R$ 50,00');
    expect(resposta).toContain('almoço');
    expect(resposta).toContain('Conta Corrente');
  });

  test('inclui resumo de gastos da semana na resposta', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-1', valor: 80, tipo: 'saida' });
    mockGetSaldoConsolidado.mockResolvedValue({ saldo: 500, entradas: 3000, saidas: 2500 });
    mockGetExtrato.mockResolvedValue({ items: [], totals: { totalIn: 0, totalOut: 320 } });

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 80, descricao: 'Farmácia' });

    expect(resposta).toContain('📈 Total gasto nesta semana: R$ 320,00');
  });

  test('inclui alerta quando saldo está baixo (< R$ 100)', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-1', valor: 80, tipo: 'saida' });
    mockGetSaldoConsolidado.mockResolvedValue({ saldo: 45, entradas: 3000, saidas: 2955 });
    mockGetExtrato.mockResolvedValue({ items: [], totals: { totalIn: 0, totalOut: 320 } });

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 80, descricao: 'Farmácia' });

    expect(resposta).toContain('⚠️ Atenção: seu saldo está baixo (R$ 45,00).');
  });

  test('inclui alerta de saldo negativo quando saldo < 0', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-1', valor: 80, tipo: 'saida' });
    mockGetSaldoConsolidado.mockResolvedValue({ saldo: -50, entradas: 200, saidas: 250 });
    mockGetExtrato.mockResolvedValue({ items: [], totals: { totalIn: 0, totalOut: 150 } });

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 80, descricao: 'Farmácia' });

    expect(resposta).toContain('⚠️ Atenção: seu saldo está negativo (R$ -50,00).');
  });

  test('não inclui alerta quando saldo está OK (>= R$ 100)', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-1', valor: 50, tipo: 'saida' });
    mockGetSaldoConsolidado.mockResolvedValue({ saldo: 1200, entradas: 3000, saidas: 1800 });
    mockGetExtrato.mockResolvedValue({ items: [], totals: { totalIn: 0, totalOut: 200 } });

    const resposta = await executarAcao(usuario, INTENT_CREATE_EXPENSE, { valor: 50, descricao: 'almoço' });

    expect(resposta).not.toContain('⚠️');
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
    mockGetSaldoConsolidado.mockResolvedValue({ saldo: 500, entradas: 3000, saidas: 2500 });
    mockGetExtrato.mockResolvedValue({ items: [], totals: { totalIn: 0, totalOut: 100 } });

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

  test('cria movimentação de entrada e retorna resposta formatada com nome do usuário', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-2', valor: 2000, tipo: 'entrada' });

    const resposta = await executarAcao(usuario, INTENT_CREATE_INCOME, { valor: 2000, descricao: 'cliente X' });

    expect(mockCreateMovimentacao).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ conta_id: 'conta-1', tipo: 'entrada', valor: 2000, descricao: 'cliente X' }),
    );
    expect(resposta).toContain('✅ Receita registrada, João!');
    expect(resposta).toContain('R$ 2.000,00');
    expect(resposta).toContain('cliente X');
    expect(resposta).toContain('Poupança');
  });
});

// ============================================================
// executarAcao — GET_BALANCE
// ============================================================

describe('executarAcao — GET_BALANCE', () => {
  const usuario = { id: 'user-1', nome: 'João' };

  test('retorna saldo consolidado formatado com nome do usuário', async () => {
    mockGetSaldoConsolidado.mockResolvedValue({ saldo: 1234.56, entradas: 5000, saidas: 3765.44 });

    const resposta = await executarAcao(usuario, INTENT_GET_BALANCE, {});

    expect(mockGetSaldoConsolidado).toHaveBeenCalledWith('user-1');
    expect(resposta).toContain('💰 Saldo de João');
    expect(resposta).toContain('R$ 1.234,56');
    expect(resposta).toContain('R$ 5.000,00');
    expect(resposta).toContain('R$ 3.765,44');
  });
});

// ============================================================
// executarAcao — GET_STATEMENT
// ============================================================

describe('executarAcao — GET_STATEMENT', () => {
  const usuario = { id: 'user-1', nome: 'João' };

  test('retorna extrato com itens formatados e nome do usuário', async () => {
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
    expect(resposta).toContain('📊 Extrato da semana — João');
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

    expect(resposta).toContain('📊 Extrato da mês');
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

// ============================================================
// executarAcao — CREATE_BILL
// ============================================================

describe('executarAcao — CREATE_BILL', () => {
  const usuario = { id: 'user-1', nome: 'João' };

  test('registra conta a pagar e retorna resposta formatada', async () => {
    mockCreateContaPagar.mockResolvedValue({ id: 'cp-1', valor: 150, descricao: 'Conta de Luz' });

    const resposta = await executarAcao(usuario, INTENT_CREATE_BILL, {
      valor: 150,
      descricao: 'Conta de Luz',
      data_vencimento: '2026-04-15',
    });

    expect(mockCreateContaPagar).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ descricao: 'Conta de Luz', valor: 150, data_vencimento: '2026-04-15' }),
    );
    expect(resposta).toContain('📋 Conta a pagar registrada!');
    expect(resposta).toContain('R$ 150,00');
    expect(resposta).toContain('Conta de Luz');
  });

  test('usa descrição padrão quando descricao está vazia', async () => {
    mockCreateContaPagar.mockResolvedValue({ id: 'cp-2', valor: 80, descricao: 'Conta via WhatsApp' });

    const resposta = await executarAcao(usuario, INTENT_CREATE_BILL, {
      valor: 80,
      descricao: '',
      data_vencimento: null,
    });

    expect(mockCreateContaPagar).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ descricao: 'Conta via WhatsApp' }),
    );
    expect(resposta).toContain('Conta via WhatsApp');
  });
});

// ============================================================
// executarAcao — PAY_BILL
// ============================================================

describe('executarAcao — PAY_BILL', () => {
  const usuario = { id: 'user-1', nome: 'João' };

  test('paga a primeira conta pendente e retorna resposta formatada', async () => {
    const contaPendente = { id: 'cp-1', descricao: 'Conta de Luz', valor: 150 };
    mockListContasPagar.mockResolvedValue({ data: [contaPendente], total: 1, page: 1, totalPages: 1 });
    mockPagarContaPagar.mockResolvedValue({ id: 'cp-1', valor: 150, status: 'pago' });

    const resposta = await executarAcao(usuario, INTENT_PAY_BILL, { descricao: 'luz' });

    expect(mockListContasPagar).toHaveBeenCalledWith('user-1', expect.objectContaining({ status: 'pendente' }));
    expect(mockPagarContaPagar).toHaveBeenCalledWith('cp-1', 'user-1', expect.objectContaining({ data_pagamento: expect.any(String) }));
    expect(resposta).toContain('✅ Conta paga!');
    expect(resposta).toContain('Conta de Luz');
    expect(resposta).toContain('R$ 150,00');
  });

  test('retorna mensagem quando não há contas pendentes', async () => {
    mockListContasPagar.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

    const resposta = await executarAcao(usuario, INTENT_PAY_BILL, { descricao: '' });

    expect(resposta).toBe('✅ Você não tem contas pendentes no momento.');
    expect(mockPagarContaPagar).not.toHaveBeenCalled();
  });

  test('encontra conta por match parcial de descrição', async () => {
    const contas = [
      { id: 'cp-1', descricao: 'Aluguel', valor: 1200 },
      { id: 'cp-2', descricao: 'Conta de Luz', valor: 150 },
    ];
    mockListContasPagar.mockResolvedValue({ data: contas, total: 2, page: 1, totalPages: 1 });
    mockPagarContaPagar.mockResolvedValue({ id: 'cp-2', valor: 150, status: 'pago' });

    const resposta = await executarAcao(usuario, INTENT_PAY_BILL, { descricao: 'luz' });

    expect(mockPagarContaPagar).toHaveBeenCalledWith('cp-2', 'user-1', expect.any(Object));
    expect(resposta).toContain('Conta de Luz');
  });
});

// ============================================================
// executarAcao — CREATE_INVESTMENT
// ============================================================

describe('executarAcao — CREATE_INVESTMENT', () => {
  const usuario = { id: 'user-1', nome: 'João' };
  const conta = { id: 'conta-1', nome: 'Conta Corrente' };

  test('registra investimento como saída e retorna resposta formatada', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-1', valor: 1000, tipo: 'saida' });

    const resposta = await executarAcao(usuario, INTENT_CREATE_INVESTMENT, { valor: 1000, descricao: 'tesouro direto' });

    expect(mockCreateMovimentacao).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ conta_id: 'conta-1', tipo: 'saida', valor: 1000, descricao: 'Investimento: tesouro direto' }),
    );
    expect(resposta).toContain('📈 Investimento registrado, João!');
    expect(resposta).toContain('R$ 1.000,00');
    expect(resposta).toContain('Conta Corrente');
  });

  test('usa descrição padrão quando descricao está vazia', async () => {
    mockListContas.mockResolvedValue([conta]);
    mockCreateMovimentacao.mockResolvedValue({ id: 'mov-2', valor: 500, tipo: 'saida' });

    const resposta = await executarAcao(usuario, INTENT_CREATE_INVESTMENT, { valor: 500, descricao: '' });

    expect(mockCreateMovimentacao).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ descricao: 'Investimento via WhatsApp' }),
    );
    expect(resposta).toContain('Investimento via WhatsApp');
  });

  test('retorna erro quando não há conta cadastrada', async () => {
    mockListContas.mockResolvedValue([]);

    const resposta = await executarAcao(usuario, INTENT_CREATE_INVESTMENT, { valor: 500, descricao: 'poupança' });

    expect(resposta).toContain('❌ Você não tem nenhuma conta cadastrada');
    expect(mockCreateMovimentacao).not.toHaveBeenCalled();
  });
});
