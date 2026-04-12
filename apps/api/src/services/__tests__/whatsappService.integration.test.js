/**
 * Integration tests — WhatsApp agent flow
 * Story 16.2 — Testes de integração do fluxo completo do agente WhatsApp
 *
 * Uses a real PostgreSQL database. Mocks only external dependencies:
 * - evolutionClient.sendText (Evolution API outbound)
 * - logger
 * - config/env
 *
 * Does NOT mock: whatsappService, nlpService, whatsappAgentService,
 * whatsappSecurityService, whatsappSenderService, evolutionPayloadParser.
 *
 * Prerequisites (handled by CI):
 *   npx prisma db push --schema=prisma/schema.prisma --skip-generate
 *   DATABASE_TEST_URL=postgresql://test:test@localhost:5432/finlly_test
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Real test-database client
// The factory is called lazily when whatsappService.js (and its deps) first
// import '../../utils/database.js'. By that time the factory has run and
// testPrisma is set, so subsequent references in test bodies are safe.
// ---------------------------------------------------------------------------
let testPrisma;

jest.unstable_mockModule('../../utils/database.js', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const dbUrl = process.env.DATABASE_TEST_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      'DATABASE_TEST_URL (or DATABASE_URL) must be set to run integration tests',
    );
  }
  const adapter = new PrismaPg({ connectionString: dbUrl });
  testPrisma = new PrismaClient({ adapter });
  return { default: testPrisma };
});

// ---------------------------------------------------------------------------
// Mock evolutionClient (external — never call real Evolution API in tests)
// ---------------------------------------------------------------------------
jest.unstable_mockModule('../../lib/evolution/evolutionClient.js', () => ({
  sendText: jest.fn().mockResolvedValue({ key: { id: 'mock_evolution_msg_id' } }),
}));

// ---------------------------------------------------------------------------
// Mock logger (silence output during tests)
// ---------------------------------------------------------------------------
jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Mock config/env (no API key validation needed in tests)
// ---------------------------------------------------------------------------
jest.unstable_mockModule('../../config/env.js', () => ({
  config: { EVOLUTION_API_KEY: null, EVOLUTION_INSTANCE: null },
}));

// ---------------------------------------------------------------------------
// Service import — must happen AFTER unstable_mockModule declarations
// ---------------------------------------------------------------------------
let processarMensagemRecebida;
let mockSendText;

beforeAll(async () => {
  const mod = await import('../whatsappService.js');
  processarMensagemRecebida = mod.processarMensagemRecebida;
  const evolutionMod = await import('../../lib/evolution/evolutionClient.js');
  mockSendText = evolutionMod.sendText;
});

afterAll(async () => {
  if (testPrisma) await testPrisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Harness & factory imports
// ---------------------------------------------------------------------------
import {
  criarUsuario,
  criarConta,
  limparDados,
  runScenario,
  assert,
} from '../../tests/harness/whatsappFlowHarness.js';
import { makeTextPayload } from '../../tests/factories/evolutionPayloadFactory.js';

// Clean slate before every test
beforeEach(async () => {
  await limparDados(testPrisma);
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fluxo 1 — Despesa ponta a ponta (RF1 / AC1)
// ---------------------------------------------------------------------------

describe('Fluxo 1 — Despesa ponta a ponta (CREATE_EXPENSE)', () => {
  test('cria movimentacao, logs INBOUND e OUTBOUND, e chama sendText', async () => {
    const phone = '5511999990001';
    const usuario = await criarUsuario(testPrisma, { whatsapp: phone });
    await criarConta(testPrisma, usuario.id);

    const payload = makeTextPayload({ phone, text: 'gastei 50 no almoço' });
    const ctx = { prisma: testPrisma, processarMensagemRecebida, mockSendText };
    const result = await runScenario(ctx, payload, { phone, userId: usuario.id });

    assert.oneMovimentacao(result.movs, 'saida', 50);
    expect(result.movs[0].descricao).toBeTruthy();
    assert.hasInboundLog(result.logs);
    assert.inboundLogUserId(result.logs, usuario.id);
    assert.hasOutboundLog(result.logs);
    assert.sendTextCalled(result.sendTextCalls);
    expect(result.sendTextCalls[0][1]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Fluxo 2 — Receita ponta a ponta (RF2 / AC2)
// ---------------------------------------------------------------------------

describe('Fluxo 2 — Receita ponta a ponta (CREATE_INCOME)', () => {
  test('cria movimentacao do tipo entrada, logs INBOUND e OUTBOUND, e chama sendText', async () => {
    const phone = '5511999990002';
    const usuario = await criarUsuario(testPrisma, { whatsapp: phone });
    await criarConta(testPrisma, usuario.id);

    const payload = makeTextPayload({ phone, text: 'recebi 2000 do cliente' });
    const ctx = { prisma: testPrisma, processarMensagemRecebida, mockSendText };
    const result = await runScenario(ctx, payload, { phone, userId: usuario.id });

    assert.oneMovimentacao(result.movs, 'entrada', 2000);
    assert.hasInboundLog(result.logs);
    assert.hasOutboundLog(result.logs);
    assert.sendTextCalled(result.sendTextCalls);
  });
});

// ---------------------------------------------------------------------------
// Fluxo 3 — Consulta de saldo (RF3 / AC3)
// ---------------------------------------------------------------------------

describe('Fluxo 3 — Consulta de saldo (GET_BALANCE)', () => {
  test('não cria movimentação, chama sendText com saldo, e cria log INBOUND', async () => {
    const phone = '5511999990003';
    const usuario = await criarUsuario(testPrisma, { whatsapp: phone });
    await criarConta(testPrisma, usuario.id);

    const payload = makeTextPayload({ phone, text: 'quanto tenho em caixa' });
    const ctx = { prisma: testPrisma, processarMensagemRecebida, mockSendText };
    const result = await runScenario(ctx, payload, { phone, userId: usuario.id });

    assert.noMovimentacoes(result.movs);
    assert.sendTextCalled(result.sendTextCalls);
    assert.hasInboundLog(result.logs);
  });
});

// ---------------------------------------------------------------------------
// Fluxo 4 — Intenção desconhecida (RF4 / AC4)
// ---------------------------------------------------------------------------

describe('Fluxo 4 — Intenção desconhecida (UNKNOWN)', () => {
  test('não cria movimentação, chama sendText com ajuda, e não lança erro', async () => {
    const phone = '5511999990004';

    const payload = makeTextPayload({ phone, text: 'oi tudo bem' });
    const ctx = { prisma: testPrisma, processarMensagemRecebida, mockSendText };

    // Não deve lançar erro — runScenario propagaria qualquer exceção
    const result = await runScenario(ctx, payload, { phone });

    // Log INBOUND criado com usuario_id=null — UNKNOWN never resolves a user
    assert.hasInboundLog(result.logs);
    assert.inboundLogUserId(result.logs, null);

    // sendText chamado (resposta de ajuda)
    assert.sendTextCalled(result.sendTextCalls);
  });
});

// ---------------------------------------------------------------------------
// Fluxo 5 — Mensagem ambígua / dados insuficientes (RF5 / AC5)
// ---------------------------------------------------------------------------

describe('Fluxo 5 — Mensagem ambígua / dados insuficientes', () => {
  test('sem valor extraível: não cria movimentação, chama sendText, não lança erro', async () => {
    const phone = '5511999990005';
    const usuario = await criarUsuario(testPrisma, { whatsapp: phone });
    await criarConta(testPrisma, usuario.id);

    const payload = makeTextPayload({ phone, text: 'gastei ontem' });
    const ctx = { prisma: testPrisma, processarMensagemRecebida, mockSendText };

    // Não deve lançar erro — runScenario propagaria qualquer exceção
    const result = await runScenario(ctx, payload, { phone, userId: usuario.id });

    assert.noMovimentacoes(result.movs);
    assert.sendTextCalled(result.sendTextCalls);
  });
});

// ---------------------------------------------------------------------------
// Fluxo 6 — Telefone sem vínculo (RF6 / AC6)
// ---------------------------------------------------------------------------

describe('Fluxo 6 — Telefone sem vínculo', () => {
  test('número desconhecido: não cria movimentação, log com status sem_usuario, chama sendText', async () => {
    // Phone in the test prefix range but not linked to any user
    const phone = '5511999990099';

    const payload = makeTextPayload({ phone, text: 'gastei 50 no almoço' });
    const ctx = { prisma: testPrisma, processarMensagemRecebida, mockSendText };
    const result = await runScenario(ctx, payload, { phone });

    expect(result.logs.length).toBeGreaterThan(0);
    assert.sendTextCalled(result.sendTextCalls);
    assert.inboundLogStatus(result.logs, 'sem_usuario');
    assert.inboundLogUserId(result.logs, null);
  });
});

// ---------------------------------------------------------------------------
// Fluxo 7 — Falha na execução após intent válida (RF8 / AC7)
// ---------------------------------------------------------------------------

describe('Fluxo 7 — Intent válida mas sem conta financeira', () => {
  test('usuário sem conta: não cria movimentação, chama sendText com erro, não lança erro', async () => {
    const phone = '5511999990007';
    // Criar usuário SEM conta financeira
    const usuario = await criarUsuario(testPrisma, { whatsapp: phone });

    const payload = makeTextPayload({ phone, text: 'gastei 50 no almoço' });
    const ctx = { prisma: testPrisma, processarMensagemRecebida, mockSendText };

    // Não deve lançar erro — runScenario propagaria qualquer exceção
    const result = await runScenario(ctx, payload, { phone, userId: usuario.id });

    assert.noMovimentacoes(result.movs);
    assert.sendTextCalled(result.sendTextCalls);
  });
});
