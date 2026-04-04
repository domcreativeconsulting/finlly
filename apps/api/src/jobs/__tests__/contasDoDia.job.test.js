import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockBuscarUsuariosComWhatsapp = jest.fn();
const mockBuscarContasDoDia = jest.fn();
const mockReplyResumoDiario = jest.fn();
const mockSendTextMessage = jest.fn();
const mockNormalizePhoneNumber = jest.fn((tel) => tel);

jest.unstable_mockModule('../../services/contasPagarDiariaService.js', () => ({
  buscarUsuariosComWhatsapp: mockBuscarUsuariosComWhatsapp,
  buscarContasDoDia: mockBuscarContasDoDia,
}));

jest.unstable_mockModule('../../lib/whatsapp/whatsappReplyBuilder.js', () => ({
  replyResumoDiario: mockReplyResumoDiario,
}));

jest.unstable_mockModule('../../services/whatsappSenderService.js', () => ({
  sendTextMessage: mockSendTextMessage,
}));

jest.unstable_mockModule('../../lib/whatsapp/evolutionPayloadParser.js', () => ({
  normalizePhoneNumber: mockNormalizePhoneNumber,
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

  test('envia resumo para cada usuário', async () => {
    const usuarios = [
      { id: 'u1', nome: 'Ana Silva', whatsapp: '5511999990001' },
      { id: 'u2', nome: 'Carlos Souza', whatsapp: '5511999990002' },
    ];
    mockBuscarUsuariosComWhatsapp.mockResolvedValue(usuarios);
    mockBuscarContasDoDia.mockResolvedValue({ hoje: [], atrasadas: [] });
    mockReplyResumoDiario.mockReturnValue('mensagem');
    mockSendTextMessage.mockResolvedValue(undefined);

    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();

    expect(mockBuscarContasDoDia).toHaveBeenCalledTimes(2);
    expect(mockSendTextMessage).toHaveBeenCalledTimes(2);
  });

  test('usa apenas o primeiro nome do usuário', async () => {
    const usuarios = [{ id: 'u1', nome: 'Ana Maria Silva', whatsapp: '5511999990001' }];
    mockBuscarUsuariosComWhatsapp.mockResolvedValue(usuarios);
    mockBuscarContasDoDia.mockResolvedValue({ hoje: [], atrasadas: [] });
    mockReplyResumoDiario.mockReturnValue('mensagem');
    mockSendTextMessage.mockResolvedValue(undefined);

    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();

    expect(mockReplyResumoDiario).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Ana' }),
    );
  });

  test('agenda próxima execução mesmo após erro no run', async () => {
    mockBuscarUsuariosComWhatsapp.mockRejectedValue(new Error('DB down'));
    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();
    expect(jest.getTimerCount()).toBe(1); // ainda agenda próxima rodada
  });

  test('falha em um usuário não interrompe o processamento dos demais', async () => {
    const usuarios = [
      { id: 'u1', nome: 'Ana', whatsapp: '5511999990001' },
      { id: 'u2', nome: 'Carlos', whatsapp: '5511999990002' },
    ];
    mockBuscarUsuariosComWhatsapp.mockResolvedValue(usuarios);
    mockBuscarContasDoDia
      .mockRejectedValueOnce(new Error('fail u1'))
      .mockResolvedValueOnce({ hoje: [], atrasadas: [] });
    mockReplyResumoDiario.mockReturnValue('mensagem');
    mockSendTextMessage.mockResolvedValue(undefined);

    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();

    // u1 failed, u2 should still be processed
    expect(mockBuscarContasDoDia).toHaveBeenCalledTimes(2);
    expect(mockSendTextMessage).toHaveBeenCalledTimes(1);
  });

  test('não chama sendTextMessage quando não há usuários com WhatsApp', async () => {
    mockBuscarUsuariosComWhatsapp.mockResolvedValue([]);
    startContasDoDiaJob();
    await jest.runOnlyPendingTimersAsync();
    expect(mockSendTextMessage).not.toHaveBeenCalled();
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
