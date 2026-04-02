import { jest } from '@jest/globals';

// ============================================================
// Mocks
// ============================================================

const mockProcessarMensagemRecebida = jest.fn();

jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../services/whatsappService.js', () => ({
  processarMensagemRecebida: mockProcessarMensagemRecebida,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
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

// ============================================================
// POST /webhooks/whatsapp
// ============================================================

describe('POST /webhooks/whatsapp', () => {
  test('retorna 200 com received:true para payload válido', async () => {
    mockProcessarMensagemRecebida.mockReturnValue({
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
    mockProcessarMensagemRecebida.mockImplementation(() => {
      throw new Error('unexpected');
    });

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

    mockProcessarMensagemRecebida.mockReturnValue({
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

    mockProcessarMensagemRecebida.mockReturnValue({
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
