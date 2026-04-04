import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockBuscarUsuariosComWhatsapp = jest.fn();
const mockAddWhatsappDiarioJob = jest.fn();

jest.unstable_mockModule('../../services/contasPagarDiariaService.js', () => ({
  buscarUsuariosComWhatsapp: mockBuscarUsuariosComWhatsapp,
}));

jest.unstable_mockModule('../../queues/whatsappDiario.queue.js', () => ({
  addWhatsappDiarioJob: mockAddWhatsappDiarioJob,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { CONTAS_DIA_JOB_HOUR_UTC: 8 },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let startContasDoDiaJob;
let stopContasDoDiaJob;

beforeAll(async () => {
  const mod = await import('../contasDoDia.job.js');
  startContasDoDiaJob = mod.startContasDoDiaJob;
  stopContasDoDiaJob = mod.stopContasDoDiaJob;
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  stopContasDoDiaJob(); // cleanup
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('startContasDoDiaJob', () => {
  test('agenda setTimeout sem executar imediatamente', () => {
    startContasDoDiaJob();
    expect(jest.getTimerCount()).toBe(1);
    expect(mockBuscarUsuariosComWhatsapp).not.toHaveBeenCalled();
  });

  test('agenda próxima execução após ser disparado pelo timer', async () => {
    mockBuscarUsuariosComWhatsapp.mockResolvedValue([]);
    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();
    expect(jest.getTimerCount()).toBe(1); // next day scheduled
  });

  test('chama buscarUsuariosComWhatsapp quando timer dispara', async () => {
    mockBuscarUsuariosComWhatsapp.mockResolvedValue([]);
    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();
    expect(mockBuscarUsuariosComWhatsapp).toHaveBeenCalledTimes(1);
  });

  test('enfileira resumo para cada usuário', async () => {
    const usuarios = [
      { id: 'u1', nome: 'Ana Silva', whatsapp: '5511999990001' },
      { id: 'u2', nome: 'Carlos Souza', whatsapp: '5511999990002' },
    ];
    mockBuscarUsuariosComWhatsapp.mockResolvedValue(usuarios);
    mockAddWhatsappDiarioJob.mockResolvedValue({ id: 'job-1' });

    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();

    expect(mockAddWhatsappDiarioJob).toHaveBeenCalledTimes(2);
    expect(mockAddWhatsappDiarioJob).toHaveBeenCalledWith({
      usuarioId: 'u1',
      nome: 'Ana Silva',
      whatsapp: '5511999990001',
    });
    expect(mockAddWhatsappDiarioJob).toHaveBeenCalledWith({
      usuarioId: 'u2',
      nome: 'Carlos Souza',
      whatsapp: '5511999990002',
    });
  });

  test('agenda próxima execução mesmo após erro no run', async () => {
    mockBuscarUsuariosComWhatsapp.mockRejectedValue(new Error('DB down'));
    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();
    expect(jest.getTimerCount()).toBe(1); // ainda agenda próxima rodada
  });

  test('falha em um usuário não interrompe o enfileiramento dos demais', async () => {
    const usuarios = [
      { id: 'u1', nome: 'Ana', whatsapp: '5511999990001' },
      { id: 'u2', nome: 'Carlos', whatsapp: '5511999990002' },
    ];
    mockBuscarUsuariosComWhatsapp.mockResolvedValue(usuarios);
    mockAddWhatsappDiarioJob
      .mockRejectedValueOnce(new Error('queue fail u1'))
      .mockResolvedValueOnce({ id: 'job-2' });

    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();

    // Both users attempted; u1 failed, u2 still enqueued
    expect(mockAddWhatsappDiarioJob).toHaveBeenCalledTimes(2);
  });

  test('não chama addWhatsappDiarioJob quando não há usuários com WhatsApp', async () => {
    mockBuscarUsuariosComWhatsapp.mockResolvedValue([]);
    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();
    expect(mockAddWhatsappDiarioJob).not.toHaveBeenCalled();
  });
});

describe('stopContasDoDiaJob', () => {
  test('cancela timeout agendado', () => {
    startContasDoDiaJob();
    expect(jest.getTimerCount()).toBe(1);
    stopContasDoDiaJob();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('não lança erro se chamado sem job ativo', () => {
    expect(() => stopContasDoDiaJob()).not.toThrow();
  });
});

