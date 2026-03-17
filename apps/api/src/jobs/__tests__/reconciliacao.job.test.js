import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockReconciliarAssinaturas = jest.fn();

jest.unstable_mockModule('../../services/reconciliacaoService.js', () => ({
  reconciliarAssinaturas: mockReconciliarAssinaturas,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { RECONCILIACAO_INTERVAL_MS: 3600000 },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let startReconciliacaoJob;
let stopReconciliacaoJob;

beforeAll(async () => {
  const mod = await import('../reconciliacao.job.js');
  startReconciliacaoJob = mod.startReconciliacaoJob;
  stopReconciliacaoJob = mod.stopReconciliacaoJob;
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  stopReconciliacaoJob(); // cleanup
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startReconciliacaoJob', () => {
  test('executa reconciliarAssinaturas imediatamente ao iniciar', async () => {
    mockReconciliarAssinaturas.mockResolvedValue({ total: 0, atualizados: 0, erros: 0 });
    startReconciliacaoJob();
    await Promise.resolve(); // flush microtasks
    expect(mockReconciliarAssinaturas).toHaveBeenCalledTimes(1);
  });

  test('agenda próxima execução após conclusão bem-sucedida', async () => {
    mockReconciliarAssinaturas.mockResolvedValue({ total: 1, atualizados: 1, erros: 0 });
    startReconciliacaoJob();
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(1); // setTimeout agendado
  });

  test('agenda próxima execução mesmo após erro', async () => {
    mockReconciliarAssinaturas.mockRejectedValue(new Error('DB down'));
    startReconciliacaoJob();
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(1); // ainda agenda próxima rodada
  });

  test('agenda próxima execução quando reconciliação é pulada (skipped)', async () => {
    mockReconciliarAssinaturas.mockResolvedValue({ skipped: true });
    startReconciliacaoJob();
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(1);
  });
});

describe('stopReconciliacaoJob', () => {
  test('cancela timeout agendado', async () => {
    mockReconciliarAssinaturas.mockResolvedValue({ total: 0, atualizados: 0, erros: 0 });
    startReconciliacaoJob();
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(1);
    stopReconciliacaoJob();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('não lança erro se chamado sem job ativo', () => {
    expect(() => stopReconciliacaoJob()).not.toThrow();
  });
});
