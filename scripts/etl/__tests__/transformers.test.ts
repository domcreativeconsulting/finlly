/**
 * Transformer unit tests — validates constraint compliance and sanitization logic.
 *
 * Run with: tsx scripts/etl/__tests__/transformers.test.ts
 */

import assert from 'assert';
import { transformCupom } from '../transformers/cupom.transformer';
import { transformJob } from '../transformers/job.transformer';
import { transformWhatsappLog } from '../transformers/whatsapp-log.transformer';
import { transformMovimentacaoCaixa } from '../transformers/movimentacao-caixa.transformer';
import { transformContaPagar } from '../transformers/conta-pagar.transformer';
import { transformContaReceber } from '../transformers/conta-receber.transformer';
import { transformInvestimentoEvento } from '../transformers/investimento-evento.transformer';
import { transformInvestimento } from '../transformers/investimento.transformer';
import { transformMeta } from '../transformers/meta.transformer';
import { transformMetaMovimento } from '../transformers/meta-movimento.transformer';
import { transformAnexo } from '../transformers/anexo.transformer';
import { transformAnexoVinculo } from '../transformers/anexo-vinculo.transformer';
import { transformAssinantePagamento } from '../transformers/assinante-pagamento.transformer';
import { transformUsuario } from '../transformers/usuario.transformer';
import { transformAssinante } from '../transformers/assinante.transformer';
import { transformConta } from '../transformers/conta.transformer';
import {
  validateCupons,
  validateMovimentacoesCaixa,
  validateJobs,
  validateWhatsappLogs,
  DataValidator,
} from '../validators/data-validator';
import { clearCache, mapId } from '../transformers/id-mapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${(err as Error).message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_MYSQL_COUPON = {
  id: 1,
  codigo: 'TEST10',
  tipo: 'percentual' as const,
  valor: 10,
  ativo: 1,
  usos: 0,
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_JOB = {
  id: 1,
  type: 'email.enviar',
  status: 'pendente',
  attempts: 0,
  max_attempts: 3,
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_WHATSAPP = {
  id: 1,
  provider: 'twilio',
  phone: '+5511999999999',
  direction: 'outbound',
  message_type: 'text',
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_TRANSACTION = {
  id: 1,
  user_id: 1,
  account_id: 1,
  type: 'entrada',
  amount: 100,
  description: 'Test',
  date: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_BILL = {
  id: 1,
  user_id: 1,
  description: 'Test bill',
  amount: 50,
  due_date: new Date(),
  status: 'pendente',
  recurring: 0,
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_RECEIVABLE = {
  id: 2,
  user_id: 1,
  description: 'Test receivable',
  amount: 75,
  due_date: new Date(),
  status: 'pendente',
  recurring: 0,
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_INVESTMENT_EVENT = {
  id: 1,
  investment_id: 1,
  user_id: 1,
  type: 'aporte',
  amount: 1000,
  date: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_INVESTMENT = {
  id: 1,
  user_id: 1,
  name: 'Investimento test',
  type_id: 1,
  initial_value: 1000,
  current_value: 1000,
  start_date: new Date(),
  status: 'ativa',
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_GOAL = {
  id: 1,
  user_id: 1,
  name: 'Meta test',
  type: 'economia',
  target_amount: 5000,
  current_amount: 0,
  start_date: new Date(),
  status: 'ativa',
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_ATTACHMENT = {
  id: 1,
  user_id: 1,
  original_name: 'file.pdf',
  file_name: 'file_12345.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1024,
  url: 'https://storage.example.com/file_12345.pdf',
  created_at: new Date(),
  updated_at: new Date(),
};

// ---------------------------------------------------------------------------
// Tests: cupom.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 cupom.transformer tests');

test('percentual type sets only desconto_percentual', () => {
  clearCache();
  const result = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'percentual', valor: 15 });
  assert.ok(result.desconto_percentual !== undefined, 'desconto_percentual should be set');
  assert.strictEqual(result.desconto_fixo, undefined, 'desconto_fixo should be undefined');
  assert.strictEqual(result.desconto_percentual, 15);
});

test('valor type sets only desconto_fixo', () => {
  clearCache();
  const result = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'valor', valor: 20 });
  assert.strictEqual(result.desconto_percentual, undefined, 'desconto_percentual should be undefined');
  assert.ok(result.desconto_fixo !== undefined, 'desconto_fixo should be set');
  assert.strictEqual(result.desconto_fixo, 20);
});

test('unknown tipo defaults to percentual (avoids ck_cupons_desconto violation)', () => {
  clearCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'unknown' as any, valor: 5 });
  const dp = result.desconto_percentual;
  const df = result.desconto_fixo;
  assert.ok((dp != null) !== (df != null), 'exactly one of desconto_percentual/fixo must be set');
});

test('null tipo defaults to percentual (avoids ck_cupons_desconto violation)', () => {
  clearCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = transformCupom({ ...BASE_MYSQL_COUPON, tipo: null as any, valor: 5 });
  assert.ok(result.desconto_percentual !== undefined, 'should default to percentual');
  assert.strictEqual(result.desconto_fixo, undefined);
});

test('desconto_percentual is clamped to [0, 100]', () => {
  clearCache();
  const over = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'percentual', valor: 150 });
  assert.strictEqual(over.desconto_percentual, 100, 'should clamp to 100');

  clearCache();
  const under = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'percentual', valor: -5 });
  assert.strictEqual(under.desconto_percentual, 0, 'should clamp to 0');
});

test('uso_maximo of 0 becomes undefined', () => {
  clearCache();
  const result = transformCupom({ ...BASE_MYSQL_COUPON, max_usos: 0 });
  assert.strictEqual(result.uso_maximo, undefined, 'uso_maximo=0 should become undefined');
});

test('uso_atual is clamped to >= 0', () => {
  clearCache();
  const result = transformCupom({ ...BASE_MYSQL_COUPON, usos: -5 });
  assert.strictEqual(result.uso_atual, 0, 'negative uso_atual should be 0');
});

test('valor=0 never produces both discount fields null', () => {
  clearCache();
  const result = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'percentual', valor: 0 });
  const dp = result.desconto_percentual;
  const df = result.desconto_fixo;
  assert.ok(dp != null || df != null, 'at least one discount field must be set when valor=0');
  assert.ok((dp != null) !== (df != null), 'exactly one discount field must be set when valor=0');
});

test('valor=undefined never produces both discount fields null', () => {
  clearCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'percentual', valor: undefined as any });
  const dp = result.desconto_percentual;
  const df = result.desconto_fixo;
  assert.ok(dp != null || df != null, 'at least one discount field must be set when valor=undefined');
  assert.ok((dp != null) !== (df != null), 'exactly one discount field must be set when valor=undefined');
});

test('valor=0 with tipo percentual defaults desconto_percentual to 1', () => {
  clearCache();
  const result = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'percentual', valor: 0 });
  assert.strictEqual(result.desconto_percentual, 1, 'desconto_percentual should default to 1 when valor=0');
  assert.strictEqual(result.desconto_fixo, undefined);
});

test('valor=0 with tipo valor defaults desconto_fixo to 1', () => {
  clearCache();
  const result = transformCupom({ ...BASE_MYSQL_COUPON, tipo: 'valor', valor: 0 });
  assert.strictEqual(result.desconto_fixo, 1, 'desconto_fixo should default to 1 when valor=0');
  assert.strictEqual(result.desconto_percentual, undefined);
});

// ---------------------------------------------------------------------------
// Tests: job.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 job.transformer tests');

test('valid status is preserved', () => {
  const result = transformJob({ ...BASE_MYSQL_JOB, status: 'concluido' });
  assert.strictEqual(result.status, 'concluido');
});

test('invalid status defaults to pendente', () => {
  const result = transformJob({ ...BASE_MYSQL_JOB, status: 'unknown_status' });
  assert.strictEqual(result.status, 'pendente');
});

test('null status defaults to pendente', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = transformJob({ ...BASE_MYSQL_JOB, status: null as any });
  assert.strictEqual(result.status, 'pendente');
});

test('max_tentativas is clamped to >= 1', () => {
  const result = transformJob({ ...BASE_MYSQL_JOB, max_attempts: 0 });
  assert.ok(result.max_tentativas >= 1, 'max_tentativas must be > 0');
});

test('tentativas is clamped to >= 0', () => {
  const result = transformJob({ ...BASE_MYSQL_JOB, attempts: -1 });
  assert.strictEqual(result.tentativas, 0);
});

// ---------------------------------------------------------------------------
// Tests: whatsapp-log.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 whatsapp-log.transformer tests');

test('outbound maps to saida', () => {
  const result = transformWhatsappLog({ ...BASE_MYSQL_WHATSAPP, direction: 'outbound' });
  assert.strictEqual(result.direcao, 'saida');
});

test('inbound maps to entrada', () => {
  const result = transformWhatsappLog({ ...BASE_MYSQL_WHATSAPP, direction: 'inbound' });
  assert.strictEqual(result.direcao, 'entrada');
});

test('sent maps to saida', () => {
  const result = transformWhatsappLog({ ...BASE_MYSQL_WHATSAPP, direction: 'sent' });
  assert.strictEqual(result.direcao, 'saida');
});

test('received maps to entrada', () => {
  const result = transformWhatsappLog({ ...BASE_MYSQL_WHATSAPP, direction: 'received' });
  assert.strictEqual(result.direcao, 'entrada');
});

test('unknown direction defaults to saida', () => {
  const result = transformWhatsappLog({ ...BASE_MYSQL_WHATSAPP, direction: 'unknown' });
  assert.strictEqual(result.direcao, 'saida');
});

// ---------------------------------------------------------------------------
// Tests: movimentacao-caixa.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 movimentacao-caixa.transformer tests');

test('zero amount is clamped to 0.01', () => {
  clearCache();
  const result = transformMovimentacaoCaixa({ ...BASE_MYSQL_TRANSACTION, amount: 0 });
  assert.ok(result !== null && result.valor > 0, 'valor deve ser > 0');
});

test('negative amount becomes positive (abs)', () => {
  clearCache();
  const result = transformMovimentacaoCaixa({ ...BASE_MYSQL_TRANSACTION, amount: -50 });
  assert.ok(result !== null && result.valor > 0, 'valor deve ser > 0');
  if (result !== null) {
    assert.strictEqual(result.valor, 50);
  }
});

test('transformMovimentacaoCaixa returns null when user_id is null', () => {
  clearCache();
  const result = transformMovimentacaoCaixa({ ...BASE_MYSQL_TRANSACTION, user_id: null });
  assert.strictEqual(result, null, 'transformMovimentacaoCaixa must return null for null user_id');
});

// ---------------------------------------------------------------------------
// Tests: conta-pagar.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 conta-pagar.transformer tests');

test('zero valor is clamped to 0.01', () => {
  clearCache();
  const result = transformContaPagar({ ...BASE_MYSQL_BILL, amount: 0 });
  assert.ok(result !== null && result.valor > 0, 'valor deve ser > 0');
});

test('transformContaPagar returns null when user_id is null', () => {
  clearCache();
  const result = transformContaPagar({ ...BASE_MYSQL_BILL, user_id: null });
  assert.strictEqual(result, null, 'transformContaPagar must return null for null user_id');
});

// ---------------------------------------------------------------------------
// Tests: conta-receber.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 conta-receber.transformer tests');

test('zero valor is clamped to 0.01', () => {
  clearCache();
  const result = transformContaReceber({ ...BASE_MYSQL_RECEIVABLE, amount: 0 });
  assert.ok(result !== null && result.valor > 0, 'valor deve ser > 0');
});

test('transformContaReceber returns null when user_id is null', () => {
  clearCache();
  const result = transformContaReceber({ ...BASE_MYSQL_RECEIVABLE, user_id: null });
  assert.strictEqual(result, null, 'transformContaReceber must return null for null user_id');
});

// ---------------------------------------------------------------------------
// Tests: investimento-evento.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 investimento-evento.transformer tests');

test('zero amount is clamped to 0.01', () => {
  clearCache();
  const validIds = new Set([mapId(BASE_MYSQL_INVESTMENT_EVENT.investment_id, 'investments')]);
  const result = transformInvestimentoEvento({ ...BASE_MYSQL_INVESTMENT_EVENT, amount: 0 }, validIds);
  assert.ok(result !== null && result.valor > 0, 'valor deve ser > 0');
});

test('transformInvestimentoEvento returns null when investimento_id not in validIds', () => {
  clearCache();
  const result = transformInvestimentoEvento(BASE_MYSQL_INVESTMENT_EVENT, new Set());
  assert.strictEqual(result, null, 'must return null when investimento_id not in validInvestimentoIds');
});

test('transformInvestimentoEvento returns record when investimento_id is valid', () => {
  clearCache();
  const validIds = new Set([mapId(BASE_MYSQL_INVESTMENT_EVENT.investment_id, 'investments')]);
  const result = transformInvestimentoEvento(BASE_MYSQL_INVESTMENT_EVENT, validIds);
  assert.ok(result !== null, 'must return a record when investimento_id is in validInvestimentoIds');
});

// ---------------------------------------------------------------------------
// Tests: investimento.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 investimento.transformer tests');

test('transformInvestimento returns null when user_id is null', () => {
  clearCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = transformInvestimento({ ...BASE_MYSQL_INVESTMENT, user_id: null as any });
  assert.strictEqual(result, null, 'transformInvestimento must return null for null user_id');
});

// ---------------------------------------------------------------------------
// Tests: meta.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 meta.transformer tests');

test('zero target_amount is clamped to 0.01', () => {
  clearCache();
  const result = transformMeta({ ...BASE_MYSQL_GOAL, target_amount: 0 });
  assert.ok(result !== null && result.valor_alvo > 0, 'valor_alvo deve ser > 0');
});

test('transformMeta returns null when user_id is null', () => {
  clearCache();
  const result = transformMeta({ ...BASE_MYSQL_GOAL, user_id: null });
  assert.strictEqual(result, null, 'transformMeta must return null for null user_id');
});

// ---------------------------------------------------------------------------
// Tests: meta-movimento.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 meta-movimento.transformer tests');

const BASE_MYSQL_GOAL_MOVEMENT = {
  id: 1,
  goal_id: 1,
  user_id: 1,
  amount: 500,
  date: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

test('transformMetaMovimento returns null when meta_id not in validMetaIds', () => {
  clearCache();
  const result = transformMetaMovimento(BASE_MYSQL_GOAL_MOVEMENT, new Set());
  assert.strictEqual(result, null, 'must return null when meta_id not in validMetaIds');
});

test('transformMetaMovimento returns record when meta_id is valid', () => {
  clearCache();
  const validIds = new Set([mapId(BASE_MYSQL_GOAL_MOVEMENT.goal_id, 'goals')]);
  const result = transformMetaMovimento(BASE_MYSQL_GOAL_MOVEMENT, validIds);
  assert.ok(result !== null, 'must return a record when meta_id is in validMetaIds');
});

test('orphaned meta movimentos are filtered out (simulated pipeline)', () => {
  clearCache();
  // Simulate: 2 metas, both filtered (NULL user_id) → validMetaIds is empty
  const validIds = new Set<string>();
  const rawMovs = [
    { ...BASE_MYSQL_GOAL_MOVEMENT, id: 1, goal_id: 1 },
    { ...BASE_MYSQL_GOAL_MOVEMENT, id: 2, goal_id: 2 },
  ];
  const result = rawMovs
    .map(m => transformMetaMovimento(m, validIds))
    .filter((v): v is NonNullable<typeof v> => v !== null);
  assert.strictEqual(result.length, 0, 'all orphaned metas_movimentos must be filtered out');
});

// ---------------------------------------------------------------------------
// Tests: anexo.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 anexo.transformer tests');

test('zero size_bytes is clamped to 1', () => {
  clearCache();
  const result = transformAnexo({ ...BASE_MYSQL_ATTACHMENT, size_bytes: 0 });
  assert.ok(result !== null && Number(result.tamanho_bytes) > 0, 'tamanho_bytes deve ser > 0');
});

test('transformAnexo returns null when user_id is null', () => {
  clearCache();
  const result = transformAnexo({ ...BASE_MYSQL_ATTACHMENT, user_id: null });
  assert.strictEqual(result, null, 'transformAnexo must return null for null user_id');
});

// ---------------------------------------------------------------------------
// Tests: anexo-vinculo.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 anexo-vinculo.transformer tests');

const BASE_MYSQL_ATTACHMENT_RELATION = {
  id: 1,
  attachment_id: 1,
  entity_type: 'bill',
  entity_id: 10,
  created_at: new Date(),
};

test('transformAnexoVinculo returns null when anexo_id not in validAnexoIds', () => {
  clearCache();
  const result = transformAnexoVinculo(BASE_MYSQL_ATTACHMENT_RELATION, new Set());
  assert.strictEqual(result, null, 'must return null when anexo_id not in validAnexoIds');
});

test('transformAnexoVinculo returns record when anexo_id is valid', () => {
  clearCache();
  const validIds = new Set([mapId(BASE_MYSQL_ATTACHMENT_RELATION.attachment_id, 'attachments')]);
  const result = transformAnexoVinculo(BASE_MYSQL_ATTACHMENT_RELATION, validIds);
  assert.ok(result !== null, 'must return a record when anexo_id is in validAnexoIds');
});

test('transformAnexoVinculo returns null for unknown entity_type regardless of validAnexoIds', () => {
  clearCache();
  const validIds = new Set([mapId(BASE_MYSQL_ATTACHMENT_RELATION.attachment_id, 'attachments')]);
  const result = transformAnexoVinculo({ ...BASE_MYSQL_ATTACHMENT_RELATION, entity_type: 'unknown_type' }, validIds);
  assert.strictEqual(result, null, 'unknown entity_type must be skipped');
});

// ---------------------------------------------------------------------------
// Tests: assinante-pagamento.transformer
// ---------------------------------------------------------------------------

console.log('\n📋 assinante-pagamento.transformer tests');

const BASE_MYSQL_PAYMENT = {
  id: 1,
  subscription_id: 7,
  user_id: 42,
  status: 'pago',
  amount: 99.90,
  created_at: new Date(),
  updated_at: new Date(),
};

test('transformAssinantePagamento returns null when assinante_id not in validAssinanteIds', () => {
  clearCache();
  const result = transformAssinantePagamento(BASE_MYSQL_PAYMENT, new Set());
  assert.strictEqual(result, null, 'must return null when assinante_id not in validAssinanteIds');
});

test('transformAssinantePagamento returns record when assinante_id is valid', () => {
  clearCache();
  const validIds = new Set([mapId(BASE_MYSQL_PAYMENT.subscription_id, 'plans')]);
  const result = transformAssinantePagamento(BASE_MYSQL_PAYMENT, validIds);
  assert.ok(result !== null, 'must return a record when assinante_id is in validAssinanteIds');
});

test('orphaned assinante_pagamentos are filtered out (simulated pipeline)', () => {
  clearCache();
  // Simulate: assinante has NULL user_id → filtered → validAssinanteIds is empty
  const validIds = new Set<string>();
  const rawPagamentos = [
    { ...BASE_MYSQL_PAYMENT, id: 1, subscription_id: 7 },
    { ...BASE_MYSQL_PAYMENT, id: 2, subscription_id: 8 },
  ];
  const result = rawPagamentos
    .map(p => transformAssinantePagamento(p, validIds))
    .filter((v): v is NonNullable<typeof v> => v !== null);
  assert.strictEqual(result.length, 0, 'all orphaned assinantes_pagamentos must be filtered out');
});

// ---------------------------------------------------------------------------
// Tests: DataValidator
// ---------------------------------------------------------------------------

console.log('\n📋 DataValidator tests');

test('validateCupons detects ck_cupons_desconto violation (both null)', () => {
  const rows = [{ id: 'uuid-1', desconto_percentual: null, desconto_fixo: null, uso_atual: 0 }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = validateCupons(rows as any);
  assert.ok(result.violationsFound > 0, 'should detect violation when both discount fields are null');
});

test('validateCupons detects desconto_percentual > 100', () => {
  const rows = [{ id: 'uuid-2', desconto_percentual: 110, desconto_fixo: null, uso_atual: 0 }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = validateCupons(rows as any);
  assert.ok(result.violationsFound > 0, 'should detect value > 100');
});

test('validateCupons passes valid percentual row', () => {
  const rows = [{ id: 'uuid-3', desconto_percentual: 15, desconto_fixo: null, uso_atual: 0 }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = validateCupons(rows as any);
  assert.strictEqual(result.violationsFound, 0, 'valid row should have no violations');
});

test('validateMovimentacoesCaixa detects valor = 0', () => {
  const rows = [{ id: 'uuid-4', valor: 0 }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = validateMovimentacoesCaixa(rows as any);
  assert.ok(result.violationsFound > 0, 'zero valor should be a violation');
});

test('validateJobs detects invalid status', () => {
  const rows = [{ tipo: 'test.job', status: 'flying', tentativas: 0, max_tentativas: 3 }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = validateJobs(rows as any);
  assert.ok(result.violationsFound > 0, 'invalid status should be a violation');
});

test('validateWhatsappLogs detects invalid direcao', () => {
  const rows = [{ id: 'uuid-5', direcao: 'outbound' }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = validateWhatsappLogs(rows as any);
  assert.ok(result.violationsFound > 0, '"outbound" is not valid for direcao');
});

test('DataValidator.validateAll returns summary with totalViolations', () => {
  const validator = new DataValidator();
  const summary = validator.validateAll({
    cupons: [{ id: 'x', desconto_percentual: null, desconto_fixo: null, uso_atual: 0 }] as never,
    assinantesPagamentos: [],
    contasPagar: [],
    contasReceber: [],
    movimentacoesCaixa: [],
    investimentosEventos: [],
    metas: [],
    anexos: [],
    jobs: [],
    whatsappLogs: [],
  });
  assert.ok(summary.totalViolations > 0, 'should report violations');
  assert.ok(Array.isArray(summary.tableResults), 'tableResults should be an array');
});

// ---------------------------------------------------------------------------
// Result summary
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests: UUID mapping consistency (prevents FK violations)
// ---------------------------------------------------------------------------

console.log('\n📋 UUID mapping consistency tests');

const BASE_MYSQL_USER = {
  id: 42,
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed',
  email_verified: 1,
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_PLAN = {
  id: 7,
  user_id: 42,
  status: 'ativo',
  plan: 'premium',
  created_at: new Date(),
  updated_at: new Date(),
};

const BASE_MYSQL_ACCOUNT = {
  id: 3,
  user_id: 42,
  name: 'Conta Corrente',
  type: 'corrente',
  include_in_total: 1,
  status: 'ativa',
  balance: 0,
  created_at: new Date(),
  updated_at: new Date(),
};

test('assinante.usuario_id matches the corresponding usuario.id', () => {
  clearCache();
  const usuario = transformUsuario(BASE_MYSQL_USER);
  const assinante = transformAssinante(BASE_MYSQL_PLAN);
  assert.ok(assinante !== null, 'transformAssinante must return a record for a valid user_id');
  assert.strictEqual(
    assinante.usuario_id,
    usuario.id,
    'assinante.usuario_id must equal the UUID generated for the corresponding usuario',
  );
});

test('conta.usuario_id matches the corresponding usuario.id', () => {
  clearCache();
  const usuario = transformUsuario(BASE_MYSQL_USER);
  const conta = transformConta(BASE_MYSQL_ACCOUNT);
  assert.ok(conta !== null, 'transformConta must return a record for a valid user_id');
  if (conta !== null) {
    assert.strictEqual(
      conta.usuario_id,
      usuario.id,
      'conta.usuario_id must equal the UUID generated for the corresponding usuario',
    );
  }
});

test('transformConta returns null when user_id is null', () => {
  clearCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = transformConta({ ...BASE_MYSQL_ACCOUNT, user_id: null as any });
  assert.strictEqual(result, null, 'transformConta must return null for null user_id');
});

test('UUID mapping is stable across clearCache() boundaries — fresh cache returns same UUID', () => {
  clearCache();
  const uuid1 = transformUsuario(BASE_MYSQL_USER).id;
  clearCache();
  const uuid2 = transformUsuario(BASE_MYSQL_USER).id;
  assert.strictEqual(uuid1, uuid2, 'mapId must be deterministic: same input always yields same UUID');
});

test('FK references remain consistent with shared cache', () => {
  clearCache();
  const usuario = transformUsuario(BASE_MYSQL_USER);
  // No clearCache() here — transforms run in the same cache context, just like etl.ts
  const assinante = transformAssinante(BASE_MYSQL_PLAN);
  assert.strictEqual(
    assinante?.usuario_id,
    usuario.id,
    'FK references must be consistent when clearCache is not called between parent and child transforms',
  );
});

test('transformAssinante returns null when user_id is null', () => {
  clearCache();
  const result = transformAssinante({ ...BASE_MYSQL_PLAN, user_id: null });
  assert.strictEqual(result, null, 'transformAssinante must return null for null user_id');
});

test('transformAssinante returns null when user_id is undefined', () => {
  clearCache();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = transformAssinante({ ...BASE_MYSQL_PLAN, user_id: undefined as any });
  assert.strictEqual(result, null, 'transformAssinante must return null for undefined user_id');
});

test('null-user_id assinantes are filtered out before LOAD (simulated)', () => {
  clearCache();
  const rawPlans = [
    { ...BASE_MYSQL_PLAN, id: 1, user_id: 42 },
    { ...BASE_MYSQL_PLAN, id: 2, user_id: null },
    { ...BASE_MYSQL_PLAN, id: 3, user_id: 42 },
  ];
  const pgAssinantes = rawPlans
    .map(transformAssinante)
    .filter((v): v is NonNullable<typeof v> => v !== null);
  assert.strictEqual(pgAssinantes.length, 2, 'null-user_id records must be filtered out');
  assert.ok(
    pgAssinantes.every(a => a.usuario_id !== null && a.usuario_id !== undefined),
    'All remaining assinantes must have a valid usuario_id',
  );
});

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ ${passed} testes passaram`);
if (failed > 0) {
  console.error(`❌ ${failed} testes falharam`);
  process.exit(1);
} else {
  console.log('🎉 Todos os testes passaram!\n');
}
