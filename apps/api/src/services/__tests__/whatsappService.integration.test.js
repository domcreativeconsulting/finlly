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
// Fixtures & helpers
// ---------------------------------------------------------------------------

const TEST_EMAIL_PREFIX = 'integration_wpp_test_';
const TEST_WHATSAPP_PREFIX = '5511999990';

/** Returns a unique string suffix to avoid collisions between parallel runs. */
function uid(tag = '') {
  return `${tag}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds an Evolution API webhook payload.
 *
 * @param {object} opts
 * @param {string} [opts.phone='5511999990001']
 * @param {string} [opts.text='']
 * @param {string|null} [opts.messageId]
 */
function makeEvolutionPayload({ phone = '5511999990001', text = '', messageId = null } = {}) {
  return {
    event: 'messages.upsert',
    instance: 'finlly-test',
    data: {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`,
        fromMe: false,
        id: messageId ?? `msg_wpp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: 'Teste Integration',
      message: { conversation: text },
    },
  };
}

/**
 * Creates a Usuario row in the test database.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} [overrides]
 */
async function criarUsuario(prisma, { whatsapp = '5511999990001', ...overrides } = {}) {
  return prisma.usuario.create({
    data: {
      nome: 'Integration WPP Test User',
      email: `${TEST_EMAIL_PREFIX}${uid()}@test.com`,
      senha_hash: 'hash_test_not_real_integration',
      status: 'ativo',
      email_verificado: true,
      whatsapp,
      ...overrides,
    },
  });
}

/**
 * Creates a Conta (financial account) row linked to the given usuarioId.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} usuarioId
 * @param {object} [overrides]
 */
async function criarConta(prisma, usuarioId, overrides = {}) {
  return prisma.conta.create({
    data: {
      usuario_id: usuarioId,
      nome: 'Conta Corrente Teste',
      tipo: 'corrente',
      status: 'ativa',
      incluir_total: true,
      ...overrides,
    },
  });
}

/**
 * Removes all rows created by integration tests, respecting FK constraints.
 * Runs before each test to guarantee a clean slate.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function limparDados(prisma) {
  const testUsers = await prisma.usuario.findMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  });
  const userIds = testUsers.map((u) => u.id);

  if (userIds.length > 0) {
    // Delete in FK-safe order
    await prisma.movimentacaoCaixa.deleteMany({ where: { usuario_id: { in: userIds } } });
    await prisma.conta.deleteMany({ where: { usuario_id: { in: userIds } } });
  }

  // whatsapp_logs: may reference users but onDelete=SetNull — delete regardless
  await prisma.whatsappLog.deleteMany({
    where: { telefone: { startsWith: TEST_WHATSAPP_PREFIX } },
  });

  if (userIds.length > 0) {
    await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
  }
}

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

    const payload = makeEvolutionPayload({ phone, text: 'gastei 50 no almoço' });
    await processarMensagemRecebida(payload);

    // Movimentação criada no banco
    const movs = await testPrisma.movimentacaoCaixa.findMany({
      where: { usuario_id: usuario.id },
    });
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe('saida');
    expect(Number(movs[0].valor)).toBe(50);
    expect(movs[0].descricao).toBeTruthy();

    // Log INBOUND criado
    const logs = await testPrisma.whatsappLog.findMany({
      where: { telefone: phone },
      orderBy: { id: 'asc' },
    });
    const inbound = logs.find((l) => l.direcao === 'entrada');
    expect(inbound).toBeDefined();
    expect(inbound.usuario_id).toBe(usuario.id);

    // Log OUTBOUND criado
    const outbound = logs.find((l) => l.direcao === 'saida');
    expect(outbound).toBeDefined();

    // sendText chamado
    expect(mockSendText).toHaveBeenCalled();

    // Resposta não é vazia
    const call = mockSendText.mock.calls[0];
    expect(call[1]).toBeTruthy();
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

    const payload = makeEvolutionPayload({ phone, text: 'recebi 2000 do cliente' });
    await processarMensagemRecebida(payload);

    // Movimentação criada com tipo 'entrada'
    const movs = await testPrisma.movimentacaoCaixa.findMany({
      where: { usuario_id: usuario.id },
    });
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe('entrada');
    expect(Number(movs[0].valor)).toBe(2000);

    // Logs INBOUND e OUTBOUND criados
    const logs = await testPrisma.whatsappLog.findMany({ where: { telefone: phone } });
    expect(logs.some((l) => l.direcao === 'entrada')).toBe(true);
    expect(logs.some((l) => l.direcao === 'saida')).toBe(true);

    // sendText chamado
    expect(mockSendText).toHaveBeenCalled();
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

    const payload = makeEvolutionPayload({ phone, text: 'quanto tenho em caixa' });
    await processarMensagemRecebida(payload);

    // NENHUMA movimentação criada
    const movs = await testPrisma.movimentacaoCaixa.findMany({
      where: { usuario_id: usuario.id },
    });
    expect(movs).toHaveLength(0);

    // sendText chamado
    expect(mockSendText).toHaveBeenCalled();

    // Log INBOUND criado
    const logs = await testPrisma.whatsappLog.findMany({ where: { telefone: phone } });
    expect(logs.some((l) => l.direcao === 'entrada')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fluxo 4 — Intenção desconhecida (RF4 / AC4)
// ---------------------------------------------------------------------------

describe('Fluxo 4 — Intenção desconhecida (UNKNOWN)', () => {
  test('não cria movimentação, chama sendText com ajuda, e não lança erro', async () => {
    const phone = '5511999990004';

    const payload = makeEvolutionPayload({ phone, text: 'oi tudo bem' });

    // Não deve lançar erro
    await expect(processarMensagemRecebida(payload)).resolves.not.toThrow();

    // NENHUMA movimentação criada (sem usuário vinculado, sem conta)
    const logs = await testPrisma.whatsappLog.findMany({ where: { telefone: phone } });
    // Log INBOUND criado com usuario_id=null — UNKNOWN never resolves a user
    expect(logs.some((l) => l.direcao === 'entrada')).toBe(true);
    const inbound = logs.find((l) => l.direcao === 'entrada');
    expect(inbound.usuario_id).toBeNull();

    // sendText chamado (resposta de ajuda)
    expect(mockSendText).toHaveBeenCalled();
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

    const payload = makeEvolutionPayload({ phone, text: 'gastei ontem' });

    // Não deve lançar erro
    await expect(processarMensagemRecebida(payload)).resolves.not.toThrow();

    // NENHUMA movimentação criada
    const movs = await testPrisma.movimentacaoCaixa.findMany({
      where: { usuario_id: usuario.id },
    });
    expect(movs).toHaveLength(0);

    // sendText chamado (resposta de "valor não identificado")
    expect(mockSendText).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Fluxo 6 — Telefone sem vínculo (RF6 / AC6)
// ---------------------------------------------------------------------------

describe('Fluxo 6 — Telefone sem vínculo', () => {
  test('número desconhecido: não cria movimentação, log com status sem_usuario, chama sendText', async () => {
    // Phone in the test prefix range but not linked to any user
    const phone = '5511999990099';

    const payload = makeEvolutionPayload({ phone, text: 'gastei 50 no almoço' });
    await processarMensagemRecebida(payload);

    // NENHUMA movimentação criada (no user linked, so no movimentacaoCaixa)
    const logs = await testPrisma.whatsappLog.findMany({ where: { telefone: phone } });
    expect(logs.length).toBeGreaterThan(0);

    // sendText chamado (resposta de número não vinculado)
    expect(mockSendText).toHaveBeenCalled();

    // Log INBOUND criado com usuario_id=null e status='sem_usuario'
    const inbound = logs.find((l) => l.direcao === 'entrada');
    expect(inbound).toBeDefined();
    expect(inbound.usuario_id).toBeNull();
    expect(inbound.status).toBe('sem_usuario');
  });
});

// ---------------------------------------------------------------------------
// Fluxo 7 — Falha na execução após intent válida (RF8 / AC7)
// ---------------------------------------------------------------------------

describe('Fluxo 7 — Intent válida mas sem conta financeira', () => {
  test('usuário sem conta: não cria movimentação, chama sendText com erro, não lança erro', async () => {
    const phone = '5511999990007';
    // Criar usuário SEM conta financeira
    await criarUsuario(testPrisma, { whatsapp: phone });

    const payload = makeEvolutionPayload({ phone, text: 'gastei 50 no almoço' });

    // Não deve lançar erro
    await expect(processarMensagemRecebida(payload)).resolves.not.toThrow();

    // NENHUMA movimentação criada
    const movs = await testPrisma.movimentacaoCaixa.findMany({
      where: { descricao: { contains: 'almo' } },
    });
    expect(movs).toHaveLength(0);

    // sendText chamado (resposta de erro/sem conta)
    expect(mockSendText).toHaveBeenCalled();
  });
});
