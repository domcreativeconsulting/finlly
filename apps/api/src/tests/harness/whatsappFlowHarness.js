/**
 * WhatsApp Flow Harness
 * Task 16.2.1 — Harness com payloads reais
 *
 * Provides a complete test harness for the WhatsApp agent flow.
 * Sets up database fixtures (user, conta), fires the agent and
 * returns structured results for assertions.
 *
 * External mocks (sendText, logger, config/env) must be set up by the
 * calling test file using jest.unstable_mockModule BEFORE importing
 * this harness.
 *
 * @module whatsappFlowHarness
 */

const TEST_EMAIL_PREFIX = 'harness_wpp_';
const TEST_WHATSAPP_PREFIX = '5511999990';

/**
 * Returns a unique string suffix to avoid collisions between parallel runs.
 * @param {string} [tag='']
 * @returns {string}
 */
export function uid(tag = '') {
  return `${tag}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a Usuario row in the test database with a whatsapp number.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} [opts]
 * @param {string} [opts.whatsapp='5511999990001'] - Digits-only phone number
 * @param {string} [opts.status='ativo']
 * @param {object} [opts.overrides] - Additional field overrides
 * @returns {Promise<object>} Created usuario
 */
export async function criarUsuario(prisma, { whatsapp = '5511999990001', status = 'ativo', ...overrides } = {}) {
  return prisma.usuario.create({
    data: {
      nome: 'Harness WPP Test User',
      email: `${TEST_EMAIL_PREFIX}${uid()}@test.com`,
      senha_hash: 'hash_test_not_real_harness',
      status,
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
 * @returns {Promise<object>} Created conta
 */
export async function criarConta(prisma, usuarioId, overrides = {}) {
  return prisma.conta.create({
    data: {
      usuario_id: usuarioId,
      nome: 'Conta Corrente Harness',
      tipo: 'corrente',
      status: 'ativa',
      incluir_total: true,
      ...overrides,
    },
  });
}

/**
 * Removes all rows created by harness tests, respecting FK constraints.
 * Safe to run as beforeEach cleanup.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<void>}
 */
export async function limparDados(prisma) {
  // Find all test users by email prefix
  const testUsers = await prisma.usuario.findMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  });
  const userIds = testUsers.map((u) => u.id);

  if (userIds.length > 0) {
    await prisma.movimentacaoCaixa.deleteMany({ where: { usuario_id: { in: userIds } } });
    // Silently ignore if table is absent in test environment or no rows exist
    await prisma.contaPagar.deleteMany({ where: { usuario_id: { in: userIds } } }).catch(() => {});
    await prisma.conta.deleteMany({ where: { usuario_id: { in: userIds } } });
  }

  // whatsapp_logs: onDelete=SetNull so delete regardless
  await prisma.whatsappLog.deleteMany({
    where: { telefone: { startsWith: TEST_WHATSAPP_PREFIX } },
  });

  if (userIds.length > 0) {
    await prisma.usuario.deleteMany({ where: { id: { in: userIds } } });
  }
}

/**
 * @typedef {object} HarnessContext
 * @property {import('@prisma/client').PrismaClient} prisma - Real test DB client
 * @property {Function} processarMensagemRecebida - Imported whatsappService function
 * @property {import('@jest/globals').jest.MockedFunction} mockSendText - Mocked sendText
 */

/**
 * @typedef {object} RunResult
 * @property {object} returnValue  - Return value from processarMensagemRecebida
 * @property {object[]} movs       - All movimentacaoCaixa rows for the user (if userId provided)
 * @property {object[]} logs       - All whatsappLog rows for the phone number
 * @property {object[]} sendTextCalls - All calls to mockSendText
 */

/**
 * Runs a full WhatsApp agent scenario and returns observable results.
 *
 * @param {HarnessContext} ctx
 * @param {object} payload - Evolution webhook payload
 * @param {object} [opts]
 * @param {string} [opts.phone] - Phone to look up logs (extracted from payload if not provided)
 * @param {string} [opts.userId] - User ID to look up movimentacoes (optional)
 * @returns {Promise<RunResult>}
 */
export async function runScenario(ctx, payload, { phone, userId } = {}) {
  const { prisma, processarMensagemRecebida, mockSendText } = ctx;

  // Extract phone from payload if not provided
  const resolvedPhone = phone ?? payload?.data?.key?.remoteJid?.replace(/@.*$/, '') ?? null;

  // Clear mock call history before this scenario
  mockSendText.mockClear();

  const returnValue = await processarMensagemRecebida(payload);

  const [movs, logs] = await Promise.all([
    userId
      ? prisma.movimentacaoCaixa.findMany({ where: { usuario_id: userId } })
      : Promise.resolve([]),
    resolvedPhone
      ? prisma.whatsappLog.findMany({
          where: { telefone: resolvedPhone },
          orderBy: { id: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  return {
    returnValue,
    movs,
    logs,
    sendTextCalls: mockSendText.mock.calls,
  };
}

/**
 * Assertion helpers for common harness checks.
 * Import and destructure these in test files for cleaner assertions.
 */
export const assert = {
  /**
   * Asserts that exactly one movimentação was created with the given type and value.
   * @param {object[]} movs
   * @param {'saida'|'entrada'} tipo
   * @param {number} valor
   */
  oneMovimentacao(movs, tipo, valor) {
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe(tipo);
    expect(Number(movs[0].valor)).toBe(valor);
  },

  /** Asserts no movimentações were created. */
  noMovimentacoes(movs) {
    expect(movs).toHaveLength(0);
  },

  /** Asserts that an INBOUND log exists. */
  hasInboundLog(logs) {
    expect(logs.some((l) => l.direcao === 'entrada')).toBe(true);
  },

  /** Asserts that an OUTBOUND log exists. */
  hasOutboundLog(logs) {
    expect(logs.some((l) => l.direcao === 'saida')).toBe(true);
  },

  /** Asserts that sendText was called at least once. */
  sendTextCalled(calls) {
    expect(calls.length).toBeGreaterThan(0);
  },

  /** Asserts that sendText was NOT called. */
  sendTextNotCalled(calls) {
    expect(calls).toHaveLength(0);
  },

  /**
   * Asserts the INBOUND log has the given status.
   * @param {object[]} logs
   * @param {string} status
   */
  inboundLogStatus(logs, status) {
    const inbound = logs.find((l) => l.direcao === 'entrada');
    expect(inbound).toBeDefined();
    expect(inbound.status).toBe(status);
  },

  /**
   * Asserts the INBOUND log has the given usuario_id.
   * @param {object[]} logs
   * @param {string|null} usuarioId
   */
  inboundLogUserId(logs, usuarioId) {
    const inbound = logs.find((l) => l.direcao === 'entrada');
    expect(inbound).toBeDefined();
    expect(inbound.usuario_id).toBe(usuarioId);
  },
};

/**
 * Pre-built scenario runners for common test cases.
 * Each function creates the necessary DB fixtures, runs the scenario
 * and returns the result.
 */
export const scenarioRunners = {
  /**
   * Runs the expense (CREATE_EXPENSE) scenario with a fully set-up user + conta.
   * @param {HarnessContext} ctx
   * @param {object} payload - Evolution payload (phone must match created user)
   * @returns {Promise<{ usuario: object, conta: object, result: RunResult }>}
   */
  async expense(ctx, payload) {
    const phone = payload?.data?.key?.remoteJid?.replace(/@.*$/, '');
    const usuario = await criarUsuario(ctx.prisma, { whatsapp: phone });
    const conta = await criarConta(ctx.prisma, usuario.id);
    const result = await runScenario(ctx, payload, { phone, userId: usuario.id });
    return { usuario, conta, result };
  },

  /**
   * Runs the income (CREATE_INCOME) scenario with a fully set-up user + conta.
   */
  async income(ctx, payload) {
    const phone = payload?.data?.key?.remoteJid?.replace(/@.*$/, '');
    const usuario = await criarUsuario(ctx.prisma, { whatsapp: phone });
    const conta = await criarConta(ctx.prisma, usuario.id);
    const result = await runScenario(ctx, payload, { phone, userId: usuario.id });
    return { usuario, conta, result };
  },

  /**
   * Runs the balance (GET_BALANCE) scenario with a fully set-up user + conta.
   */
  async balance(ctx, payload) {
    const phone = payload?.data?.key?.remoteJid?.replace(/@.*$/, '');
    const usuario = await criarUsuario(ctx.prisma, { whatsapp: phone });
    const conta = await criarConta(ctx.prisma, usuario.id);
    const result = await runScenario(ctx, payload, { phone, userId: usuario.id });
    return { usuario, conta, result };
  },

  /**
   * Runs the unknown intent scenario (no user setup needed).
   */
  async unknown(ctx, payload) {
    const phone = payload?.data?.key?.remoteJid?.replace(/@.*$/, '');
    const result = await runScenario(ctx, payload, { phone });
    return { result };
  },

  /**
   * Runs the unlinked phone scenario (no user created for this phone).
   */
  async unlinkedPhone(ctx, payload) {
    const phone = payload?.data?.key?.remoteJid?.replace(/@.*$/, '');
    const result = await runScenario(ctx, payload, { phone });
    return { result };
  },
};
