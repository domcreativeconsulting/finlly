import { jest } from '@jest/globals';

// ============================================================
// Mocks
// ============================================================

const mockEnviarMensagemImpl = jest.fn();
const mockSendTextMessage = jest.fn();
const mockIdentificarIntent = jest.fn();
const mockResolverUsuarioPorWhatsapp = jest.fn();
const mockExecutarAcao = jest.fn();
const mockCheckRateLimitPorNumero = jest.fn();
const mockRegistrarLogWhatsapp = jest.fn();
const mockValidarUsuarioAtivo = jest.fn();
const mockIsDuplicateMensagem = jest.fn();

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
  isDuplicateMensagem: mockIsDuplicateMensagem,
}));

jest.unstable_mockModule('../whatsappSenderService.js', () => ({
  sendTextMessage: mockSendTextMessage,
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
  mockIsDuplicateMensagem.mockResolvedValue(false);
  mockSendTextMessage.mockResolvedValue({ success: true, status: 'enviado', providerMessageId: null, erro: null });
});

// ============================================================
// Helpers
// ============================================================

function buildPayload({
  text = 'gastei 50 no almoço',
  from = '5511999999999',
  fromMe = false,
  name = 'João',
  messageId = undefined,
  messageTimestamp = undefined,
  instance = undefined,
} = {}) {
  return {
    event: 'messages.upsert',
    ...(instance ? { instance } : {}),
    data: {
      key: { remoteJid: `${from}@s.whatsapp.net`, fromMe, ...(messageId ? { id: messageId } : {}) },
      pushName: name,
      message: { conversation: text },
      ...(messageTimestamp ? { messageTimestamp } : {}),
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
    expect(mockSendTextMessage).not.toHaveBeenCalled();
  });

  test('ignora mensagem com apenas espaços', async () => {
    const payload = buildPayload({ text: '   ' });
    await processarMensagemRecebida(payload);

    expect(mockCheckRateLimitPorNumero).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).not.toHaveBeenCalled();
  });
});

// ============================================================
// Deduplicação (Gap 7)
// ============================================================

describe('deduplicação', () => {
  test('ignora mensagem duplicada com provider_message_id já existente', async () => {
    mockIsDuplicateMensagem.mockResolvedValue(true);
    const payload = buildPayload({ messageId: 'MSG-DUP' });

    const result = await processarMensagemRecebida(payload);

    expect(mockIsDuplicateMensagem).toHaveBeenCalledWith('MSG-DUP');
    expect(mockCheckRateLimitPorNumero).not.toHaveBeenCalled();
    expect(mockIdentificarIntent).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).not.toHaveBeenCalled();
    expect(result.from).toBe('5511999999999');
  });

  test('processa mensagem nova quando isDuplicateMensagem retorna false', async () => {
    mockIsDuplicateMensagem.mockResolvedValue(false);
    mockIdentificarIntent.mockReturnValue({ intent: 'UNKNOWN', params: {} });
    const payload = buildPayload({ messageId: 'MSG-NEW' });

    await processarMensagemRecebida(payload);

    expect(mockIsDuplicateMensagem).toHaveBeenCalledWith('MSG-NEW');
    expect(mockCheckRateLimitPorNumero).toHaveBeenCalled();
  });

  test('não chama isDuplicateMensagem quando payload não tem messageId', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'UNKNOWN', params: {} });
    const payload = buildPayload(); // no messageId

    await processarMensagemRecebida(payload);

    expect(mockIsDuplicateMensagem).not.toHaveBeenCalled();
    expect(mockCheckRateLimitPorNumero).toHaveBeenCalled();
  });
});

// ============================================================
// Rate limit bloqueado
// ============================================================

describe('rate limit', () => {
  test('bloqueia, loga e envia mensagem de rate limit ao usuário', async () => {
    mockCheckRateLimitPorNumero.mockReturnValue(false);
    const payload = buildPayload();

    await processarMensagemRecebida(payload);

    expect(mockCheckRateLimitPorNumero).toHaveBeenCalledWith('5511999999999');
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rate_limited', direcao: 'entrada' }),
    );
    expect(mockIdentificarIntent).not.toHaveBeenCalled();
    expect(mockSendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        telefone: '5511999999999',
        texto: expect.stringContaining('⏳'),
        usuarioId: null,
      }),
    );
  });

  test('loga com provider_message_id e received_at quando disponíveis', async () => {
    mockCheckRateLimitPorNumero.mockReturnValue(false);
    const payload = buildPayload({ messageId: 'MSG-RL', messageTimestamp: 1711900000 });

    await processarMensagemRecebida(payload);

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_message_id: 'MSG-RL',
        received_at: new Date(1711900000 * 1000),
        status: 'rate_limited',
      }),
    );
  });
});

// ============================================================
// Intent UNKNOWN
// ============================================================

describe('intent UNKNOWN', () => {
  test('envia menu de ajuda e loga entrada', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'UNKNOWN', params: {} });
    const payload = buildPayload({ text: 'olá' });

    await processarMensagemRecebida(payload);

    expect(mockSendTextMessage).toHaveBeenCalledTimes(1);
    expect(mockResolverUsuarioPorWhatsapp).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledTimes(1);
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'entrada', usuario_id: null }),
    );
  });

  test('loga entrada com payload_raw e instance_name', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'UNKNOWN', params: {} });
    const payload = buildPayload({ text: 'olá', instance: 'minha-instancia', messageId: 'MSG1', messageTimestamp: 1711900000 });

    await processarMensagemRecebida(payload);

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({
        direcao: 'entrada',
        payload_raw: JSON.stringify(payload),
        instance_name: 'minha-instancia',
        provider_message_id: 'MSG1',
        received_at: new Date(1711900000 * 1000),
      }),
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
    expect(mockSendTextMessage).toHaveBeenCalledTimes(1);
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

    expect(mockSendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        telefone: '5511999999999',
        texto: expect.stringContaining('⛔'),
      }),
    );
    expect(mockSendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        texto: expect.stringContaining('suporte@finlly.com.br'),
      }),
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
    expect(mockSendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        telefone: '5511999999999',
        texto: '💰 Seu saldo atual é R$ 500,00',
        usuarioId: 'user-1',
      }),
    );

    // Entrada log
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ direcao: 'entrada', usuario_id: 'user-1', conteudo: 'quanto tenho?' }),
    );

    expect(result).toMatchObject({ from: '5511999999999', fromMe: false });
  });

  test('não lança erro quando sendTextMessage retorna falha', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'GET_BALANCE', params: {} });
    mockResolverUsuarioPorWhatsapp.mockResolvedValue(usuario);
    mockValidarUsuarioAtivo.mockReturnValue({ valido: true, mensagem: null });
    mockExecutarAcao.mockResolvedValue('saldo ok');
    mockSendTextMessage.mockResolvedValue({ success: false, status: 'falha', providerMessageId: null, erro: 'Evolution API down' });

    const payload = buildPayload();
    // Should not throw — sendTextMessage never rejects
    await expect(processarMensagemRecebida(payload)).resolves.not.toThrow();

    // sendTextMessage should still have been called
    expect(mockSendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ telefone: '5511999999999', texto: 'saldo ok' }),
    );
  });

  test('passa provider_message_id, received_at, payload_raw e instance_name no log de entrada', async () => {
    mockIdentificarIntent.mockReturnValue({ intent: 'GET_BALANCE', params: {} });
    mockResolverUsuarioPorWhatsapp.mockResolvedValue(usuario);
    mockValidarUsuarioAtivo.mockReturnValue({ valido: true, mensagem: null });
    mockExecutarAcao.mockResolvedValue('saldo ok');

    const payload = buildPayload({
      text: 'saldo',
      messageId: 'MSG-XYZ',
      messageTimestamp: 1711900000,
      instance: 'finlly-prod',
    });
    await processarMensagemRecebida(payload);

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({
        direcao: 'entrada',
        provider_message_id: 'MSG-XYZ',
        received_at: new Date(1711900000 * 1000),
        payload_raw: JSON.stringify(payload),
        instance_name: 'finlly-prod',
      }),
    );
  });
});
