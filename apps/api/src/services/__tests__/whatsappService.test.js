import { jest } from '@jest/globals';

// ============================================================
// Mocks
// ============================================================

const mockEnviarMensagemImpl = jest.fn();
const mockIdentificarIntent = jest.fn();
const mockResolverUsuarioPorWhatsapp = jest.fn();
const mockExecutarAcao = jest.fn();
const mockCheckRateLimitPorNumero = jest.fn();
const mockRegistrarLogWhatsapp = jest.fn();
const mockValidarUsuarioAtivo = jest.fn();

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../lib/evolution/evolutionClient.js', () => ({
  sendText: mockEnviarMensagemImpl,
}));

jest.unstable_mockModule('../nlpService.js', () => ({
  identificarIntent: mockIdentificarIntent,
  INTENT_UNKNOWN: 'UNKNOWN',
}));

jest.unstable_mockModule('../whatsappAgentService.js', () => ({
  resolverUsuarioPorWhatsapp: mockResolverUsuarioPorWhatsapp,
  executarAcao: mockExecutarAcao,
}));

jest.unstable_mockModule('../whatsappSecurityService.js', () => ({
  checkRateLimitPorNumero: mockCheckRateLimitPorNumero,
  registrarLogWhatsapp: mockRegistrarLogWhatsapp,
  validarUsuarioAtivo: mockValidarUsuarioAtivo,
}));

// ============================================================
// Module under test
// ============================================================

let processarMensagemRecebida;

beforeAll(async () => {
  const mod = await import('../whatsappService.js');
  processarMensagemRecebida = mod.processarMensagemRecebida;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Defaults
  mockCheckRateLimitPorNumero.mockReturnValue(true);
  mockRegistrarLogWhatsapp.mockResolvedValue(undefined);
  mockValidarUsuarioAtivo.mockReturnValue({ valido: true, mensagem: null });
  mockEnviarMensagemImpl.mockResolvedValue({ success: true });
});

// ============================================================
// Helpers
// ============================================================

function buildPayload({ text = 'gastei 50 no almoço', from = '5511999999999', fromMe = false, name = 'João' } = {}) {
  return {
    event: 'messages.upsert',
    data: {
      key: { remoteJid: `${from}@s.whatsapp.net`, fromMe },
      pushName: name,
      message: { conversation: text },
    },
  };
}

// ============================================================
// fromMe — mensagens enviadas pelo bot são ignoradas
// ============================================================

describe('mensagem fromMe', () => {
  test('retorna cedo sem processar quando fromMe=true', async () => {
    const payload = buildPayload({ fromMe: true });
    const result = await processarMensagemRecebida(payload);

    expect(result.fromMe).toBe(true);
    expect(mockCheckRateLimitPorNumero).not.toHaveBeenCalled();
    expect(mockIdentificarIntent).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).not.toHaveBeenCalled();
  });
});

// ============================================================
// Mensagem com texto vazio — ignorada silenciosamente
// ============================================================

describe('texto vazio', () => {
  test('ignora silenciosamente mensagem com texto vazio', async () => {
    const payload = buildPayload({ text: '' });
    const result = await processarMensagemRecebida(payload);

    expect(result.text).toBe('');
    expect(mockCheckRateLimitPorNumero).not.toHaveBeenCalled();
    expect(mockIdentificarIntent).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).not.toHaveBeenCalled();
    expect(mockEnviarMensagemImpl).not.toHaveBeenCalled();
  });

  test('ignora mensagem com apenas espaços', async () => {
    const payload = buildPayload({ text: '   ' });
    await processarMensagemRecebida(payload);

    expect(mockCheckRateLimitPorNumero).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).not.toHaveBeenCalled();
  });
});

// ============================================================
// Rate limit bloqueado
// ============================================================

describe('rate limit', () => {
  test('bloqueia e loga quando rate limit excedido', async () => {
    mockCheckRateLimitPorNumero.mockReturnValue(false);
    const payload = buildPayload();

    await processarMensagemRecebida(payload);

    expect(mockCheckRateLimitPorNumero).toHaveBeenCalledWith('5511999999999');
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rate_limited', direcao: 'entrada' }),
    );
    expect(mockIdentificarIntent).not.toHaveBeenCalled();
    expect(mockEnviarMensagemImpl).not.toHaveBeenCalled();
  });
});

// ============================================================
// Intent UNKNOWN
// ============================================================

describe('intent UNKNOWN', () => {
  test('envia menu de ajuda e loga entrada e saída', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'UNKNOWN', params: {} });
    const payload = buildPayload({ text: 'olá' });

    await processarMensagemRecebida(payload);

    expect(mockEnviarMensagemImpl).toHaveBeenCalledTimes(1);
    expect(mockResolverUsuarioPorWhatsapp).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledTimes(2);
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'entrada', usuario_id: null }),
    );
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'saida', usuario_id: null }),
    );
  });
});

// ============================================================
// Número não vinculado
// ============================================================

describe('número não vinculado', () => {
  test('loga com status sem_usuario e envia orientação', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'GET_BALANCE', params: {} });
    mockResolverUsuarioPorWhatsapp.mockResolvedValue(null);

    const payload = buildPayload();
    await processarMensagemRecebida(payload);

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sem_usuario', direcao: 'entrada', usuario_id: null }),
    );
    expect(mockEnviarMensagemImpl).toHaveBeenCalledTimes(1);
    expect(mockExecutarAcao).not.toHaveBeenCalled();
  });
});

// ============================================================
// Usuário inativo / suspenso
// ============================================================

describe('usuário inativo', () => {
  test('envia mensagem de conta suspensa e loga', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'GET_BALANCE', params: {} });
    const usuario = { id: 'user-1', status: 'suspenso' };
    mockResolverUsuarioPorWhatsapp.mockResolvedValue(usuario);
    mockValidarUsuarioAtivo.mockReturnValue({
      valido: false,
      mensagem: '⛔ Sua conta está suspensa. Entre em contato com o suporte.',
    });

    const payload = buildPayload();
    await processarMensagemRecebida(payload);

    expect(mockEnviarMensagemImpl).toHaveBeenCalledWith(
      '5511999999999',
      '⛔ Sua conta está suspensa. Entre em contato com o suporte.',
    );
    expect(mockExecutarAcao).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'usuario_inativo', direcao: 'entrada', usuario_id: 'user-1' }),
    );
  });
});

// ============================================================
// Fluxo completo — usuário ativo
// ============================================================

describe('fluxo completo — usuário ativo', () => {
  const usuario = { id: 'user-1', nome: 'João', status: 'ativo' };

  test('executa ação e loga entrada e saída', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'GET_BALANCE', params: {} });
    mockResolverUsuarioPorWhatsapp.mockResolvedValue(usuario);
    mockValidarUsuarioAtivo.mockReturnValue({ valido: true, mensagem: null });
    mockExecutarAcao.mockResolvedValue('💰 Seu saldo atual é R$ 500,00');

    const payload = buildPayload({ text: 'quanto tenho?' });
    const result = await processarMensagemRecebida(payload);

    expect(mockExecutarAcao).toHaveBeenCalledWith(usuario, 'GET_BALANCE', {});
    expect(mockEnviarMensagemImpl).toHaveBeenCalledWith('5511999999999', '💰 Seu saldo atual é R$ 500,00');

    // Entrada log
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'entrada', usuario_id: 'user-1', conteudo: 'quanto tenho?' }),
    );
    // Saída log
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'saida', usuario_id: 'user-1', conteudo: '💰 Seu saldo atual é R$ 500,00' }),
    );

    expect(result).toMatchObject({ from: '5511999999999', fromMe: false });
  });

  test('loga saída mesmo quando enviarMensagem lança erro', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'GET_BALANCE', params: {} });
    mockResolverUsuarioPorWhatsapp.mockResolvedValue(usuario);
    mockValidarUsuarioAtivo.mockReturnValue({ valido: true, mensagem: null });
    mockExecutarAcao.mockResolvedValue('saldo ok');
    mockEnviarMensagemImpl.mockRejectedValue(new Error('Evolution API down'));

    const payload = buildPayload();
    // Should not throw
    await expect(processarMensagemRecebida(payload)).resolves.not.toThrow();

    // Log de saída ainda deve ter sido chamado
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'saida', conteudo: 'saldo ok' }),
    );
  });
});
