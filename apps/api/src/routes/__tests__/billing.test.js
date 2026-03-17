import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

// Mocks de serviços
const mockCriarAssinatura = jest.fn();
const mockCancelarAssinatura = jest.fn();
const mockGetStatusAssinatura = jest.fn();
const mockProcessarWebhookAsaas = jest.fn();
const mockReconciliarAssinaturas = jest.fn();

// express-rate-limit → passthrough em testes
jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

// Serviços
jest.unstable_mockModule('../../services/billingService.js', () => ({
  criarAssinatura: mockCriarAssinatura,
  cancelarAssinatura: mockCancelarAssinatura,
  getStatusAssinatura: mockGetStatusAssinatura,
}));

jest.unstable_mockModule('../../services/webhookService.js', () => ({
  processarWebhookAsaas: mockProcessarWebhookAsaas,
}));

jest.unstable_mockModule('../../services/reconciliacaoService.js', () => ({
  reconciliarAssinaturas: mockReconciliarAssinaturas,
}));

// logger
jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// config/env.js
jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    NODE_ENV: 'test',
    ASAAS_WEBHOOK_SECRET: 'test_webhook_secret',
  },
}));

// jwtAuthMiddleware — passa adiante sem sobrescrever req.user já definido pelo makeApp()
jest.unstable_mockModule('../../middleware/jwtAuth.js', () => ({
  jwtAuthMiddleware: (req, _res, next) => {
    if (!req.user) {
      req.user = { sub: 'usuario-uuid-001', role: 'user' };
    }
    next();
  },
}));

let billingRouter;
let express;

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/billing.js');
  billingRouter = mod.default;
});

beforeEach(() => {
  mockCriarAssinatura.mockReset();
  mockCancelarAssinatura.mockReset();
  mockGetStatusAssinatura.mockReset();
  mockProcessarWebhookAsaas.mockReset();
  mockReconciliarAssinaturas.mockReset();
});

function makeApp({ role = 'user' } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: 'usuario-uuid-001', role };
    next();
  });
  app.use(billingRouter);
  app.use((err, req, res, _next) => {
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

// ============================================================
// POST /billing/subscribe
// ============================================================

describe('POST /billing/subscribe', () => {
  const bodyValido = {
    plano: 'mensal',
    ciclo: 'mensal',
    formaPagamento: 'PIX',
  };

  test('retorna 201 com message, assinante e paymentLink para body válido sem cupom', async () => {
    const assinante = { id: 'assinante-uuid-001', status: 'ativo' };
    const paymentLink = 'https://pix.asaas.com/pay/123';
    mockCriarAssinatura.mockResolvedValue({ assinante, paymentLink });

    const app = makeApp();
    const res = await request(app, 'POST', '/billing/subscribe', bodyValido);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: 'Assinatura criada com sucesso',
      assinante,
      paymentLink,
    });
    expect(mockCriarAssinatura).toHaveBeenCalledWith('usuario-uuid-001', bodyValido);
  });

  test('retorna 201 para body válido com cupomCodigo opcional', async () => {
    const assinante = { id: 'assinante-uuid-002', status: 'ativo' };
    const paymentLink = 'https://pix.asaas.com/pay/456';
    mockCriarAssinatura.mockResolvedValue({ assinante, paymentLink });

    const bodyComCupom = {
      ...bodyValido,
      cupomCodigo: 'DESCONTO10',
      ciclo: 'anual',
      plano: 'anual',
      formaPagamento: 'CREDIT_CARD',
    };
    const app = makeApp();
    const res = await request(app, 'POST', '/billing/subscribe', bodyComCupom);

    expect(res.status).toBe(201);
    expect(res.body.assinante).toEqual(assinante);
    expect(res.body.paymentLink).toBe(paymentLink);
  });

  test('retorna 422 (VALIDATION_ERROR) quando plano está ausente', async () => {
    const app = makeApp();
    const { plano: _plano, ...semPlano } = bodyValido;
    const res = await request(app, 'POST', '/billing/subscribe', semPlano);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando ciclo está ausente', async () => {
    const app = makeApp();
    const { ciclo: _ciclo, ...semCiclo } = bodyValido;
    const res = await request(app, 'POST', '/billing/subscribe', semCiclo);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando formaPagamento está ausente', async () => {
    const app = makeApp();
    const { formaPagamento: _formaPagamento, ...semFormaPagamento } = bodyValido;
    const res = await request(app, 'POST', '/billing/subscribe', semFormaPagamento);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando formaPagamento tem valor inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/billing/subscribe', { ...bodyValido, formaPagamento: 'BOLETO' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 400 quando criarAssinatura lança AppError.badRequest (Cupom inválido)', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCriarAssinatura.mockRejectedValue(AppError.badRequest('Cupom inválido ou expirado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/billing/subscribe', bodyValido);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.message).toBe('Cupom inválido ou expirado');
  });

  test('retorna 404 quando criarAssinatura lança AppError.notFound (Usuário não encontrado)', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCriarAssinatura.mockRejectedValue(AppError.notFound('Usuário não encontrado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/billing/subscribe', bodyValido);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(res.body.message).toBe('Usuário não encontrado');
  });
});

// ============================================================
// POST /billing/cancel
// ============================================================

describe('POST /billing/cancel', () => {
  test('retorna 200 com mensagem de sucesso quando cancelarAssinatura resolve', async () => {
    mockCancelarAssinatura.mockResolvedValue(undefined);

    const app = makeApp();
    const res = await request(app, 'POST', '/billing/cancel', {});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Assinatura cancelada com sucesso' });
    expect(mockCancelarAssinatura).toHaveBeenCalledWith('usuario-uuid-001');
  });

  test('retorna 400 quando cancelarAssinatura lança AppError.badRequest (Nenhuma assinatura ativa)', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCancelarAssinatura.mockRejectedValue(AppError.badRequest('Nenhuma assinatura ativa encontrada'));

    const app = makeApp();
    const res = await request(app, 'POST', '/billing/cancel', {});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.message).toBe('Nenhuma assinatura ativa encontrada');
  });

  test('retorna 400 quando cancelarAssinatura lança AppError.badRequest (Assinatura já cancelada)', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCancelarAssinatura.mockRejectedValue(AppError.badRequest('Assinatura já cancelada'));

    const app = makeApp();
    const res = await request(app, 'POST', '/billing/cancel', {});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.message).toBe('Assinatura já cancelada');
  });
});

// ============================================================
// GET /billing/status
// ============================================================

describe('GET /billing/status', () => {
  test('retorna 200 com objeto assinante quando assinatura existe', async () => {
    const assinante = { id: 'assinante-uuid-001', status: 'ativo', plano: 'mensal' };
    mockGetStatusAssinatura.mockResolvedValue(assinante);

    const app = makeApp();
    const res = await request(app, 'GET', '/billing/status', null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ assinante });
    expect(mockGetStatusAssinatura).toHaveBeenCalledWith('usuario-uuid-001');
  });

  test('retorna 200 com assinante null quando não há assinatura', async () => {
    mockGetStatusAssinatura.mockResolvedValue(null);

    const app = makeApp();
    const res = await request(app, 'GET', '/billing/status', null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ assinante: null });
  });
});

// ============================================================
// POST /billing/admin/reconciliar
// ============================================================

describe('POST /billing/admin/reconciliar', () => {
  test('retorna 200 com summary quando admin chama e reconciliarAssinaturas resolve', async () => {
    const summary = { total: 10, atualizados: 3, erros: 0 };
    mockReconciliarAssinaturas.mockResolvedValue(summary);

    const app = makeApp({ role: 'admin' });
    const res = await request(app, 'POST', '/billing/admin/reconciliar', {});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(summary);
    expect(mockReconciliarAssinaturas).toHaveBeenCalledTimes(1);
  });

  test('retorna 403 (FORBIDDEN) quando usuário com role user tenta acessar', async () => {
    const app = makeApp({ role: 'user' });
    const res = await request(app, 'POST', '/billing/admin/reconciliar', {});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(mockReconciliarAssinaturas).not.toHaveBeenCalled();
  });
});

// ============================================================
// POST /webhooks/asaas
// ============================================================

describe('POST /webhooks/asaas', () => {
  test('retorna 200 com { received: true } quando processarWebhookAsaas resolve com sucesso', async () => {
    mockProcessarWebhookAsaas.mockResolvedValue({ processed: true, event: 'PAYMENT_RECEIVED' });

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/asaas', { event: 'PAYMENT_RECEIVED', id: 'evt_001' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockProcessarWebhookAsaas).toHaveBeenCalledTimes(1);
  });

  test('retorna 401 quando processarWebhookAsaas lança AppError.unauthorized (Assinatura inválida)', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockProcessarWebhookAsaas.mockRejectedValue(AppError.unauthorized('Assinatura inválida'));

    const app = makeApp();
    const res = await request(app, 'POST', '/webhooks/asaas', { event: 'PAYMENT_RECEIVED', id: 'evt_001' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.message).toBe('Assinatura inválida');
  });
});
