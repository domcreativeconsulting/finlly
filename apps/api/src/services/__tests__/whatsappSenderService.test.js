import { jest } from '@jest/globals';

// ============================================================
// Mocks
// ============================================================

const mockSendText = jest.fn();
const mockRegistrarLogWhatsapp = jest.fn();

const mockConfig = {
  EVOLUTION_INSTANCE: 'finlly-test',
};

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../lib/evolution/evolutionClient.js', () => ({
  sendText: mockSendText,
}));

jest.unstable_mockModule('../whatsappSecurityService.js', () => ({
  registrarLogWhatsapp: mockRegistrarLogWhatsapp,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: mockConfig,
}));

// ============================================================
// Module under test
// ============================================================

let sendTextMessage;

beforeAll(async () => {
  const mod = await import('../whatsappSenderService.js');
  sendTextMessage = mod.sendTextMessage;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRegistrarLogWhatsapp.mockResolvedValue(undefined);
  mockSendText.mockResolvedValue({ key: { id: 'MSG-PROVIDER-123' } });
  mockConfig.EVOLUTION_INSTANCE = 'finlly-test';
});

// ============================================================
// Texto vazio — retorno imediato sem envio e sem log
// ============================================================

describe('texto vazio', () => {
  test('retorna falha imediata sem envio quando texto é vazio', async () => {
    const result = await sendTextMessage({ telefone: '5511999999999', texto: '' });

    expect(result).toEqual({
      success: false,
      status: 'falha',
      providerMessageId: null,
      erro: 'Mensagem vazia',
    });
    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).not.toHaveBeenCalled();
  });

  test('retorna falha imediata sem envio quando texto é apenas espaços', async () => {
    const result = await sendTextMessage({ telefone: '5511999999999', texto: '   ' });

    expect(result.success).toBe(false);
    expect(result.erro).toBe('Mensagem vazia');
    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).not.toHaveBeenCalled();
  });

  test('retorna falha imediata sem envio quando texto é null', async () => {
    const result = await sendTextMessage({ telefone: '5511999999999', texto: null });

    expect(result.success).toBe(false);
    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockRegistrarLogWhatsapp).not.toHaveBeenCalled();
  });
});

// ============================================================
// Normalização do telefone
// ============================================================

describe('normalização do telefone', () => {
  test('normaliza telefone antes de enviar — remove não-dígitos', async () => {
    await sendTextMessage({ telefone: '+55 (11) 99999-9999', texto: 'olá' });

    expect(mockSendText).toHaveBeenCalledWith('5511999999999', 'olá');
  });

  test('usa telefone normalizado no log', async () => {
    await sendTextMessage({ telefone: '+55 (11) 99999-9999', texto: 'olá' });

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ telefone: '5511999999999' }),
    );
  });

  test('não altera telefone já normalizado', async () => {
    await sendTextMessage({ telefone: '5511999999999', texto: 'olá' });

    expect(mockSendText).toHaveBeenCalledWith('5511999999999', 'olá');
  });
});

// ============================================================
// Envio bem-sucedido
// ============================================================

describe('envio bem-sucedido', () => {
  test('retorna success: true, status: enviado e providerMessageId', async () => {
    const result = await sendTextMessage({ telefone: '5511999999999', texto: 'Olá!' });

    expect(result).toEqual({
      success: true,
      status: 'enviado',
      providerMessageId: 'MSG-PROVIDER-123',
      erro: null,
    });
  });

  test('captura providerMessageId da resposta (campo key.id)', async () => {
    mockSendText.mockResolvedValue({ key: { id: 'EVOLUTION-ID-XYZ' } });

    const result = await sendTextMessage({ telefone: '5511999999999', texto: 'Teste' });

    expect(result.providerMessageId).toBe('EVOLUTION-ID-XYZ');
  });

  test('providerMessageId é null quando resposta não tem key.id', async () => {
    mockSendText.mockResolvedValue({ status: 'PENDING' });

    const result = await sendTextMessage({ telefone: '5511999999999', texto: 'Teste' });

    expect(result.providerMessageId).toBeNull();
  });

  test('persiste log com status enviado', async () => {
    await sendTextMessage({ telefone: '5511999999999', texto: 'Olá!', usuarioId: 'user-uuid-1' });

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: 'user-uuid-1',
        telefone: '5511999999999',
        direcao: 'saida',
        tipo_mensagem: 'text',
        conteudo: 'Olá!',
        status: 'enviado',
        provider_message_id: 'MSG-PROVIDER-123',
      }),
    );
  });
});

// ============================================================
// Falha na Evolution API
// ============================================================

describe('falha na Evolution API', () => {
  test('retorna success: false, status: falha quando sendText lança erro', async () => {
    mockSendText.mockRejectedValue(new Error('Erro de conexão com a Evolution API'));

    const result = await sendTextMessage({ telefone: '5511999999999', texto: 'Olá!' });

    expect(result).toEqual({
      success: false,
      status: 'falha',
      providerMessageId: null,
      erro: 'Erro de conexão com a Evolution API',
    });
  });

  test('nunca relança a exceção da Evolution — sempre retorna objeto', async () => {
    mockSendText.mockRejectedValue(new Error('HTTP 500'));

    await expect(
      sendTextMessage({ telefone: '5511999999999', texto: 'Olá!' }),
    ).resolves.not.toThrow();
  });

  test('persiste log com status falha mesmo em erro', async () => {
    mockSendText.mockRejectedValue(new Error('Evolution API down'));

    await sendTextMessage({ telefone: '5511999999999', texto: 'Olá!', usuarioId: 'user-uuid-2' });

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: 'user-uuid-2',
        telefone: '5511999999999',
        direcao: 'saida',
        status: 'falha',
      }),
    );
  });
});

// ============================================================
// Log de saída sempre persistido
// ============================================================

describe('log de saída sempre persistido', () => {
  test('persiste log em sucesso com campos completos', async () => {
    mockConfig.EVOLUTION_INSTANCE = 'minha-instancia';

    await sendTextMessage({ telefone: '5511999999999', texto: 'Mensagem de teste', usuarioId: 'uuid-123' });

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledTimes(1);
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: 'uuid-123',
        telefone: '5511999999999',
        direcao: 'saida',
        tipo_mensagem: 'text',
        conteudo: 'Mensagem de teste',
        status: 'enviado',
        instance_name: 'minha-instancia',
      }),
    );
  });

  test('persiste log em falha', async () => {
    mockSendText.mockRejectedValue(new Error('Network error'));

    await sendTextMessage({ telefone: '5511999999999', texto: 'Mensagem' });

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledTimes(1);
    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({
        direcao: 'saida',
        status: 'falha',
      }),
    );
  });

  test('payload_raw contém apenas o request body — sem credenciais', async () => {
    await sendTextMessage({ telefone: '5511999999999', texto: 'Olá!' });

    const call = mockRegistrarLogWhatsapp.mock.calls[0][0];
    const payloadRaw = JSON.parse(call.payload_raw);

    expect(payloadRaw).toEqual({ number: '5511999999999', text: 'Olá!' });
    expect(call.payload_raw).not.toContain('apikey');
    expect(call.payload_raw).not.toContain('EVOLUTION_API_KEY');
  });

  test('usa null para usuarioId quando não fornecido', async () => {
    await sendTextMessage({ telefone: '5511999999999', texto: 'Olá!' });

    expect(mockRegistrarLogWhatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: null }),
    );
  });
});

// ============================================================
// Token/credenciais não aparecem em logs
// ============================================================

describe('segurança — credenciais não expostas', () => {
  test('erro sanitizado não contém apikey ou token', async () => {
    mockSendText.mockRejectedValue(new Error('Erro de conexão com a Evolution API'));

    const result = await sendTextMessage({ telefone: '5511999999999', texto: 'Olá!' });

    expect(result.erro).not.toMatch(/apikey/i);
    expect(result.erro).not.toMatch(/token/i);
    expect(result.erro).not.toMatch(/authorization/i);
  });

  test('payload_raw persistido não contém cabeçalhos de autenticação', async () => {
    await sendTextMessage({ telefone: '5511999999999', texto: 'Olá!' });

    const call = mockRegistrarLogWhatsapp.mock.calls[0][0];
    expect(call.payload_raw).not.toContain('apikey');
    expect(call.payload_raw).not.toContain('Authorization');
    expect(call.payload_raw).not.toContain('Bearer');
  });
});
