import { describe, test, expect, beforeAll } from '@jest/globals';

// ============================================================
// Module under test (no mocks needed — pure logic)
// ============================================================

let identificarIntent;
let INTENT_CREATE_EXPENSE;
let INTENT_CREATE_INCOME;
let INTENT_GET_BALANCE;
let INTENT_GET_STATEMENT;
let INTENT_UNKNOWN;

beforeAll(async () => {
  const mod = await import('../nlpService.js');
  identificarIntent = mod.identificarIntent;
  INTENT_CREATE_EXPENSE = mod.INTENT_CREATE_EXPENSE;
  INTENT_CREATE_INCOME = mod.INTENT_CREATE_INCOME;
  INTENT_GET_BALANCE = mod.INTENT_GET_BALANCE;
  INTENT_GET_STATEMENT = mod.INTENT_GET_STATEMENT;
  INTENT_UNKNOWN = mod.INTENT_UNKNOWN;
});

// ============================================================
// CREATE_EXPENSE
// ============================================================

describe('identificarIntent — CREATE_EXPENSE', () => {
  test('"gastei 50 no almoço" → valor 50, descricao almoço', () => {
    const result = identificarIntent('gastei 50 no almoço');
    expect(result.intent).toBe(INTENT_CREATE_EXPENSE);
    expect(result.params.valor).toBe(50);
    expect(result.params.descricao).toBe('almoço');
  });

  test('"paguei 120,50 no mercado" → valor 120.50 (vírgula normalizada), descricao mercado', () => {
    const result = identificarIntent('paguei 120,50 no mercado');
    expect(result.intent).toBe(INTENT_CREATE_EXPENSE);
    expect(result.params.valor).toBe(120.5);
    expect(result.params.descricao).toBe('mercado');
  });

  test('"comprei 30 de pão" → CREATE_EXPENSE com valor 30', () => {
    const result = identificarIntent('comprei 30 de pão');
    expect(result.intent).toBe(INTENT_CREATE_EXPENSE);
    expect(result.params.valor).toBe(30);
  });

  test('"saiu 200 do cartão" → CREATE_EXPENSE com valor 200', () => {
    const result = identificarIntent('saiu 200 do cartão');
    expect(result.intent).toBe(INTENT_CREATE_EXPENSE);
    expect(result.params.valor).toBe(200);
  });

  test('case insensitive: "GASTEI 80 NA FARMÁCIA" → CREATE_EXPENSE', () => {
    const result = identificarIntent('GASTEI 80 NA FARMÁCIA');
    expect(result.intent).toBe(INTENT_CREATE_EXPENSE);
    expect(result.params.valor).toBe(80);
  });
});

// ============================================================
// CREATE_INCOME
// ============================================================

describe('identificarIntent — CREATE_INCOME', () => {
  test('"recebi 2000 do cliente X" → valor 2000, descricao cliente x', () => {
    const result = identificarIntent('recebi 2000 do cliente X');
    expect(result.intent).toBe(INTENT_CREATE_INCOME);
    expect(result.params.valor).toBe(2000);
    expect(result.params.descricao).toBe('cliente x');
  });

  test('"entrou 500 de freela" → valor 500, descricao freela', () => {
    const result = identificarIntent('entrou 500 de freela');
    expect(result.intent).toBe(INTENT_CREATE_INCOME);
    expect(result.params.valor).toBe(500);
    expect(result.params.descricao).toBe('freela');
  });

  test('"ganhei 1500 no projeto" → CREATE_INCOME com valor 1500', () => {
    const result = identificarIntent('ganhei 1500 no projeto');
    expect(result.intent).toBe(INTENT_CREATE_INCOME);
    expect(result.params.valor).toBe(1500);
  });

  test('case insensitive: "RECEBI 300" → CREATE_INCOME', () => {
    const result = identificarIntent('RECEBI 300');
    expect(result.intent).toBe(INTENT_CREATE_INCOME);
    expect(result.params.valor).toBe(300);
  });
});

// ============================================================
// GET_BALANCE
// ============================================================

describe('identificarIntent — GET_BALANCE', () => {
  test('"qual meu saldo?" → GET_BALANCE com params vazio', () => {
    const result = identificarIntent('qual meu saldo?');
    expect(result.intent).toBe(INTENT_GET_BALANCE);
    expect(result.params).toEqual({});
  });

  test('"quanto tenho em caixa?" → GET_BALANCE', () => {
    const result = identificarIntent('quanto tenho em caixa?');
    expect(result.intent).toBe(INTENT_GET_BALANCE);
    expect(result.params).toEqual({});
  });

  test('"o que está disponível?" → GET_BALANCE', () => {
    const result = identificarIntent('o que está disponível?');
    expect(result.intent).toBe(INTENT_GET_BALANCE);
    expect(result.params).toEqual({});
  });

  test('case insensitive: "QUANTO TENHO" → GET_BALANCE', () => {
    const result = identificarIntent('QUANTO TENHO');
    expect(result.intent).toBe(INTENT_GET_BALANCE);
  });
});

// ============================================================
// GET_STATEMENT
// ============================================================

describe('identificarIntent — GET_STATEMENT', () => {
  test('"me mostra meus gastos da semana" → GET_STATEMENT, periodo semana', () => {
    const result = identificarIntent('me mostra meus gastos da semana');
    expect(result.intent).toBe(INTENT_GET_STATEMENT);
    expect(result.params.periodo).toBe('semana');
  });

  test('"extrato do mês" → GET_STATEMENT, periodo mes', () => {
    const result = identificarIntent('extrato do mês');
    expect(result.intent).toBe(INTENT_GET_STATEMENT);
    expect(result.params.periodo).toBe('mes');
  });

  test('"ver movimentações" → GET_STATEMENT', () => {
    const result = identificarIntent('ver movimentações');
    expect(result.intent).toBe(INTENT_GET_STATEMENT);
  });

  test('"resumo do mês" → GET_STATEMENT, periodo mes', () => {
    const result = identificarIntent('resumo do mês');
    expect(result.intent).toBe(INTENT_GET_STATEMENT);
    expect(result.params.periodo).toBe('mes');
  });

  test('case insensitive: "EXTRATO" → GET_STATEMENT', () => {
    const result = identificarIntent('EXTRATO');
    expect(result.intent).toBe(INTENT_GET_STATEMENT);
  });
});

// ============================================================
// UNKNOWN
// ============================================================

describe('identificarIntent — UNKNOWN', () => {
  test('"bom dia!" → UNKNOWN com params vazio', () => {
    const result = identificarIntent('bom dia!');
    expect(result.intent).toBe(INTENT_UNKNOWN);
    expect(result.params).toEqual({});
  });

  test('"texto completamente aleatório" → UNKNOWN', () => {
    const result = identificarIntent('texto completamente aleatório');
    expect(result.intent).toBe(INTENT_UNKNOWN);
    expect(result.params).toEqual({});
  });

  test('"qual o horário de funcionamento?" → UNKNOWN', () => {
    const result = identificarIntent('qual o horário de funcionamento?');
    expect(result.intent).toBe(INTENT_UNKNOWN);
    expect(result.params).toEqual({});
  });

  test('empty string → UNKNOWN', () => {
    const result = identificarIntent('');
    expect(result.intent).toBe(INTENT_UNKNOWN);
    expect(result.params).toEqual({});
  });
});

// ============================================================
// Value normalisation
// ============================================================

describe('normalização de valor monetário', () => {
  test('vírgula convertida para ponto: "gastei 99,90 no jantar"', () => {
    const result = identificarIntent('gastei 99,90 no jantar');
    expect(result.params.valor).toBe(99.9);
  });

  test('valor sem decimais: "recebi 3000"', () => {
    const result = identificarIntent('recebi 3000');
    expect(result.params.valor).toBe(3000);
  });
});
