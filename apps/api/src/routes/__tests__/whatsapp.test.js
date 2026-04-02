import { jest } from '@jest/globals';

// ============================================================
// Mocks
// ============================================================

const mockProcessarMensagemRecebida = jest.fn();

// Use a mutable object so mutations in tests are reflected in the route module.
const mockConfig = {
  EVOLUTION_API_KEY: undefined,
  EVOLUTION_INSTANCE: undefined,
};

jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../services/whatsappService.js', () => ({
  processarMensagemRecebida: mockProcessarMensagemRecebida,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: mockConfig,
}));

// ============================================================
// Module under test
// ============================================================

let whatsappRouter;
let express;

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/whatsapp.js');
  whatsappRouter = mod.default;
});

beforeEach(() => {
  mockProcessarMensagemRecebida.mockReset();
  // Reset config state by mutating in place (preserves object reference)
  mockConfig.EVOLUTION_API_KEY = undefined;
  mockConfig.EVOLUTION_INSTANCE = undefined;
});

// ============================================================
// Helpers
// ============================================================

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(whatsappRouter);
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message,
      details: err.details,
    });
  });
  return app;
}

async function request(app, method, path, body, headers = {}) {
  const { default: http } = await import('http');
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const data = body ? JSON.stringify(body) : undefined;
      const options = {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      };
      const req = http.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          server.close(() =>
            resolve({ status: res.statusCode, body: JSON.parse(rawData), headers: res.headers }),
          );
        });
      });
      req.on('error', (e) => server.close(() => reject(e)));
      if (data) req.write(data);
      req.end();
    });
  });
}

const payloadValido = {
  event: 'messages.upsert',
  data: {
    key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
    message: { conversation: 'gastei 50 no almoço' },
    pushName: 'João',
  },
};

const payloadComCamposExtras = {
  event: 'messages.upsert',
  instance: 'minha-instancia',
  data: {
    key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'MSG123' },
    messageTimestamp: 1711900000,
    message: { conversation: 'gastei 50 no almoço' },
    pushName: 'João',
  },
};

// ============================================================
// POST /webhooks/whatsapp (legacy)
// ============================================================

describe('POST /webhooks/whatsapp', () => {
  test('retorna 200 com received:true para payload válido', async () => {
    mockProcessarMensagemRecebida.mockResolvedValue({
      from: '5511999999999',
      name: 'João',
      text: 'gastei 50 no almoço',
      fromMe: false,
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', payloadValido);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockProcessarMensagemRecebida).toHaveBeenCalledWith(payloadValido);
  });

  test('retorna 200 para eventos que não são messages.upsert (sem processar)', async () => {
    const payload = { event: 'connection.update', data: { key: { remoteJid: '5511999999999@s.whatsapp.net' } } };

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockProcessarMensagemRecebida).not.toHaveBeenCalled();
  });

  test('retorna 422 para payload sem campo event', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', {
      data: { key: { remoteJid: '5511999999999@s.whatsapp.net' } },
    });

    expect(res.status).toBe(422);
  });

  test('retorna 422 para payload sem data', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', { event: 'messages.upsert' });

    expect(res.status).toBe(422);
  });

  test('retorna 422 para payload sem data.key.remoteJid', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', {
      event: 'messages.upsert',
      data: { key: {} },
    });

    expect(res.status).toBe(422);
  });

  test('propaga erros do service como 500', async () => {
    mockProcessarMensagemRecebida.mockRejectedValue(new Error('unexpected'));

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', payloadValido);

    expect(res.status).toBe(500);
  });

  test('aceita payload com message.extendedTextMessage', async () => {
    const payloadExtended = {
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { extendedTextMessage: { text: 'mensagem longa' } },
        pushName: 'Maria',
      },
    };

    mockProcessarMensagemRecebida.mockResolvedValue({
      from: '5511999999999',
      name: 'Maria',
      text: 'mensagem longa',
      fromMe: false,
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', payloadExtended);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  test('aceita payload sem campo message (outros tipos de evento upsert)', async () => {
    const payloadSemMensagem = {
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        pushName: 'Carlos',
      },
    };

    mockProcessarMensagemRecebida.mockResolvedValue({
      from: '5511999999999',
      name: 'Carlos',
      text: '',
      fromMe: false,
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', payloadSemMensagem);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});

// ============================================================
// POST /webhooks/evolution (primary — Gap 1)
// ============================================================

describe('POST /webhooks/evolution', () => {
  test('retorna 200 com received:true para payload válido', async () => {
    mockProcessarMensagemRecebida.mockResolvedValue({
      from: '5511999999999',
      name: 'João',
      text: 'gastei 50 no almoço',
      fromMe: false,
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', payloadValido);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockProcessarMensagemRecebida).toHaveBeenCalledWith(payloadValido);
  });

  test('retorna 200 para eventos que não são messages.upsert', async () => {
    const payload = { event: 'connection.update', data: { key: { remoteJid: '5511999999999@s.whatsapp.net' } } };

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockProcessarMensagemRecebida).not.toHaveBeenCalled();
  });

  test('aceita payload com instance, messageTimestamp e key.id', async () => {
    mockProcessarMensagemRecebida.mockResolvedValue({
      from: '5511999999999',
      name: 'João',
      text: 'gastei 50 no almoço',
      fromMe: false,
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', payloadComCamposExtras);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockProcessarMensagemRecebida).toHaveBeenCalledWith(payloadComCamposExtras);
  });

  test('retorna 422 para payload inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', {
      data: { key: { remoteJid: '5511999999999@s.whatsapp.net' } },
    });

    expect(res.status).toBe(422);
  });
});

// ============================================================
// API key validation (Gap 2)
// ============================================================

describe('API key validation', () => {
  test('permite requisição quando EVOLUTION_API_KEY não está configurado', async () => {
    mockConfig.EVOLUTION_API_KEY = undefined;
    mockProcessarMensagemRecebida.mockResolvedValue({ from: '55', name: 'X', text: 't', fromMe: false });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', payloadValido);

    expect(res.status).toBe(200);
  });

  test('rejeita com 401 quando EVOLUTION_API_KEY está configurado e header ausente', async () => {
    mockConfig.EVOLUTION_API_KEY = 'secret-key';

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', payloadValido);

    expect(res.status).toBe(401);
    expect(mockProcessarMensagemRecebida).not.toHaveBeenCalled();
  });

  test('rejeita com 401 quando apikey header não bate com EVOLUTION_API_KEY', async () => {
    mockConfig.EVOLUTION_API_KEY = 'secret-key';

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', payloadValido, { apikey: 'wrong-key' });

    expect(res.status).toBe(401);
    expect(mockProcessarMensagemRecebida).not.toHaveBeenCalled();
  });

  test('permite requisição quando apikey header bate com EVOLUTION_API_KEY', async () => {
    mockConfig.EVOLUTION_API_KEY = 'secret-key';
    mockProcessarMensagemRecebida.mockResolvedValue({ from: '55', name: 'X', text: 't', fromMe: false });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', payloadValido, { apikey: 'secret-key' });

    expect(res.status).toBe(200);
    expect(mockProcessarMensagemRecebida).toHaveBeenCalled();
  });

  test('rejeita com 401 quando instância no payload não bate com EVOLUTION_INSTANCE', async () => {
    mockConfig.EVOLUTION_API_KEY = undefined;
    mockConfig.EVOLUTION_INSTANCE = 'instancia-certa';

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', {
      ...payloadValido,
      instance: 'instancia-errada',
    });

    expect(res.status).toBe(401);
    expect(mockProcessarMensagemRecebida).not.toHaveBeenCalled();
  });

  test('permite quando instância no payload bate com EVOLUTION_INSTANCE', async () => {
    mockConfig.EVOLUTION_API_KEY = undefined;
    mockConfig.EVOLUTION_INSTANCE = 'instancia-certa';
    mockProcessarMensagemRecebida.mockResolvedValue({ from: '55', name: 'X', text: 't', fromMe: false });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/evolution', {
      ...payloadValido,
      instance: 'instancia-certa',
    });

    expect(res.status).toBe(200);
  });

  test('também aplica validação de apikey no endpoint /webhooks/whatsapp legado', async () => {
    mockConfig.EVOLUTION_API_KEY = 'secret-key';

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/whatsapp', payloadValido);

    expect(res.status).toBe(401);
    expect(mockProcessarMensagemRecebida).not.toHaveBeenCalled();
  });
});
