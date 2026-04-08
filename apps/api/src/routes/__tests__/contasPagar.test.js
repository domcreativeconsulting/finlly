import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

const mockListContasPagar = jest.fn();
const mockGetContaPagar = jest.fn();
const mockCreateContaPagar = jest.fn();
const mockUpdateContaPagar = jest.fn();
const mockDeleteContaPagar = jest.fn();
const mockPagarConta = jest.fn();
const mockCancelarContaPagar = jest.fn();
const mockCancelarGrupo = jest.fn();

jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
  ipKeyGenerator: (req) => req.ip || '127.0.0.1',
}));

jest.unstable_mockModule('../../utils/rateLimitStore.js', () => ({
  userOrIpKeyGenerator: (req) => req.user?.sub || req.ip || '127.0.0.1',
  buildStore: () => undefined,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    NODE_ENV: 'test',
    RATE_LIMIT_READ_MAX: 60,
    RATE_LIMIT_READ_WINDOW_MS: 900000,
    RATE_LIMIT_WRITE_MAX: 30,
    RATE_LIMIT_WRITE_WINDOW_MS: 900000,
  },
}));

jest.unstable_mockModule('../../services/contasPagarService.js', () => ({
  listContasPagar: mockListContasPagar,
  getContaPagar: mockGetContaPagar,
  createContaPagar: mockCreateContaPagar,
  updateContaPagar: mockUpdateContaPagar,
  deleteContaPagar: mockDeleteContaPagar,
  pagarConta: mockPagarConta,
  cancelarContaPagar: mockCancelarContaPagar,
  cancelarGrupo: mockCancelarGrupo,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../middleware/jwtAuth.js', () => ({
  jwtAuthMiddleware: (req, _res, next) => {
    if (!req.user) req.user = { sub: 'usuario-uuid-001', role: 'user' };
    next();
  },
}));

jest.unstable_mockModule('../../middleware/requireAtivo.js', () => ({
  requireAtivo: (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../middleware/auditoria.js', () => ({
  auditarAcao: () => (_req, _res, next) => next(),
}));

let contasPagarRouter;
let express;

const CONTA_PAGAR_ID = '11111111-1111-4111-8111-111111111111';
const GRUPO_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = 'usuario-uuid-001';

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/contasPagar.js');
  contasPagarRouter = mod.default;
});

beforeEach(() => {
  mockListContasPagar.mockReset();
  mockGetContaPagar.mockReset();
  mockCreateContaPagar.mockReset();
  mockUpdateContaPagar.mockReset();
  mockDeleteContaPagar.mockReset();
  mockPagarConta.mockReset();
  mockCancelarContaPagar.mockReset();
  mockCancelarGrupo.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: USER_ID, role: 'user' };
    next();
  });
  app.use(contasPagarRouter);
  app.use((err, req, res, _next) => {
    res.status(err.status || err.statusCode || 500).json({
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
            resolve({ status: res.statusCode, body: rawData ? JSON.parse(rawData) : null, headers: res.headers }),
          );
        });
      });
      req.on('error', (e) => server.close(() => reject(e)));
      if (data) req.write(data);
      req.end();
    });
  });
}

const contaPagarBase = {
  id: CONTA_PAGAR_ID,
  usuario_id: USER_ID,
  descricao: 'Aluguel',
  valor: 1500,
  data_vencimento: '2026-02-01',
  status: 'pendente',
  categoria_id: null,
  conta_id: null,
  observacoes: null,
  recorrente: false,
  tipo_recorrencia: null,
  grupo_id: null,
  parcela_numero: null,
  total_parcelas: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

// ============================================================
// GET /contas-pagar
// ============================================================

describe('GET /contas-pagar', () => {
  test('retorna 200 com lista de contas a pagar', async () => {
    mockListContasPagar.mockResolvedValue({ items: [contaPagarBase], page: 1, limit: 20, total: 1, totalPages: 1 });

    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar', null);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(mockListContasPagar).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });

  test('retorna 422 com status inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar?status=invalido', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 500 em erro inesperado', async () => {
    mockListContasPagar.mockRejectedValue(new Error('DB error'));

    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar', null);

    expect(res.status).toBe(500);
  });
});

// ============================================================
// GET /contas-pagar/:id
// ============================================================
describe('GET /contas-pagar/:id', () => {
  test('retorna 200 com conta a pagar', async () => {
    mockGetContaPagar.mockResolvedValue(contaPagarBase);

    const app = makeApp();
    const res = await request(app, 'GET', `/contas-pagar/${CONTA_PAGAR_ID}`, null);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: CONTA_PAGAR_ID });
    expect(mockGetContaPagar).toHaveBeenCalledWith(CONTA_PAGAR_ID, USER_ID);
  });

  test('retorna 404 quando não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockGetContaPagar.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar/nao-existe', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ============================================================
// POST /contas-pagar
// ============================================================
describe('POST /contas-pagar', () => {
  const bodyValido = {
    descricao: 'Aluguel',
    valor: 1500,
    data_vencimento: '2026-02-01',
  };

  test('retorna 201 com conta criada', async () => {
    mockCreateContaPagar.mockResolvedValue(contaPagarBase);

    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', bodyValido);

    expect(res.status).toBe(201);
    expect(mockCreateContaPagar).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });

  test('retorna 422 quando descricao está ausente', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', { valor: 100, data_vencimento: '2026-02-01' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando valor é zero ou negativo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', { ...bodyValido, valor: 0 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando data_vencimento tem formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', { ...bodyValido, data_vencimento: '01/02/2026' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('userId vem de req.user.sub, nunca do body', async () => {
    mockCreateContaPagar.mockResolvedValue(contaPagarBase);

    const app = makeApp();
    await request(app, 'POST', '/contas-pagar', { ...bodyValido, userId: 'outro-usuario' });

    expect(mockCreateContaPagar).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });

  test('retorna 500 em erro inesperado', async () => {
    mockCreateContaPagar.mockRejectedValue(new Error('DB error'));

    const app = makeApp();
    const res = await request(app, 'POST', bodyValido);

    expect(res.status).toBe(500);
  });
});

// ============================================================
// PUT/PATCH /contas-pagar/:id
// ============================================================
describe('PATCH /contas-pagar/:id', () => {
  test('retorna 200 com conta atualizada', async () => {
    mockUpdateContaPagar.mockResolvedValue({ ...contaPagarBase, descricao: 'Novo nome' });

    const app = makeApp();
    const res = await request(app, 'PATCH', `/contas-pagar/${CONTA_PAGAR_ID}`, { descricao: 'Novo nome' });

    expect(res.status).toBe(200);
    expect(mockUpdateContaPagar).toHaveBeenCalledWith(CONTA_PAGAR_ID, USER_ID, expect.any(Object));
  });

  test('retorna 404 quando não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockUpdateContaPagar.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/nao-existe', { descricao: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 500 em erro inesperado', async () => {
    mockUpdateContaPagar.mockRejectedValue(new Error('DB error'));

    const app = makeApp();
    const res = await request(app, 'PATCH', `/contas-pagar/${CONTA_PAGAR_ID}`, { descricao: 'X' });

    expect(res.status).toBe(500);
  });
});

// ============================================================
// DELETE /contas-pagar/:id
// ============================================================
describe('DELETE /contas-pagar/:id', () => {
  test('retorna 204 ao excluir', async () => {
    mockDeleteContaPagar.mockResolvedValue(undefined);

    const app = makeApp();
    const res = await request(app, 'DELETE', `/contas-pagar/${CONTA_PAGAR_ID}`, null);

    expect(res.status).toBe(204);
    expect(mockDeleteContaPagar).toHaveBeenCalledWith(CONTA_PAGAR_ID, USER_ID);
  });

  test('retorna 404 quando não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockDeleteContaPagar.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'DELETE', '/contas-pagar/nao-existe', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 500 em erro inesperado', async () => {
    mockDeleteContaPagar.mockRejectedValue(new Error('DB error'));

    const app = makeApp();
    const res = await request(app, 'DELETE', `/contas-pagar/${CONTA_PAGAR_ID}`, null);

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /contas-pagar/:id/pagar
// ============================================================
describe('POST /contas-pagar/:id/pagar', () => {
  test('retorna 200 ao marcar como paga', async () => {
    mockPagarConta.mockResolvedValue({ ...contaPagarBase, status: 'pago' });

    const app = makeApp();
    const res = await request(app, 'POST', `/contas-pagar/${CONTA_PAGAR_ID}/pagar`, {});

    expect(res.status).toBe(200);
    expect(mockPagarConta).toHaveBeenCalledWith(CONTA_PAGAR_ID, USER_ID, expect.any(Object));
  });

  test('retorna 404 quando não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockPagarConta.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar/nao-existe/pagar', {});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 500 em erro inesperado', async () => {
    mockPagarConta.mockRejectedValue(new Error('DB error'));

    const app = makeApp();
    const res = await request(app, 'POST', `/contas-pagar/${CONTA_PAGAR_ID}/pagar`, {});

    expect(res.status).toBe(500);
  });
});

// ============================================================
// PATCH /contas-pagar/:id/cancelar
// ============================================================
describe('PATCH /contas-pagar/:id/cancelar', () => {
  test('retorna 200 ao cancelar conta', async () => {
    mockCancelarContaPagar.mockResolvedValue({ ...contaPagarBase, status: 'cancelado' });

    const app = makeApp();
    const res = await request(app, 'PATCH', `/contas-pagar/${CONTA_PAGAR_ID}/cancelar`, null);

    expect(res.status).toBe(200);
    expect(mockCancelarContaPagar).toHaveBeenCalledWith(CONTA_PAGAR_ID, USER_ID);
  });

  test('retorna 404 quando não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCancelarContaPagar.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/nao-existe/cancelar', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ============================================================
// PATCH /contas-pagar/grupos/:grupoId/cancelar
// ============================================================
describe('PATCH /contas-pagar/grupos/:grupoId/cancelar', () => {
  test('retorna 200 ao cancelar grupo', async () => {
    mockCancelarGrupo.mockResolvedValue({ canceladas: 3 });

    const app = makeApp();
    const res = await request(app, 'PATCH', `/contas-pagar/grupos/${GRUPO_ID}/cancelar`, null);

    expect(res.status).toBe(200);
    expect(mockCancelarGrupo).toHaveBeenCalledWith(GRUPO_ID, USER_ID);
  });

  test('retorna 404 quando grupo não encontrado', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCancelarGrupo.mockRejectedValue(AppError.notFound('Grupo não encontrado'));

    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/grupos/nao-existe/cancelar', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});