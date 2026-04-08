import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

const mockListMetas = jest.fn();
const mockGetMeta = jest.fn();
const mockCreateMeta = jest.fn();
const mockUpdateMeta = jest.fn();
const mockDeleteMeta = jest.fn();
const mockCreateMovimento = jest.fn();
const mockDeleteMovimento = jest.fn();
const mockGetProgresso = jest.fn();
const mockListMovimentos = jest.fn();

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

jest.unstable_mockModule('../../services/metaService.js', () => ({
  listMetas: mockListMetas,
  getMeta: mockGetMeta,
  createMeta: mockCreateMeta,
  updateMeta: mockUpdateMeta,
  deleteMeta: mockDeleteMeta,
  createMovimento: mockCreateMovimento,
  deleteMovimento: mockDeleteMovimento,
  getProgresso: mockGetProgresso,
  listMovimentos: mockListMovimentos,
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

let metasRouter;
let express;

const META_ID = '33333333-3333-4333-8333-333333333333';
const MOV_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = 'usuario-uuid-001';

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/metas.js');
  metasRouter = mod.default;
});

beforeEach(() => {
  mockListMetas.mockReset();
  mockGetMeta.mockReset();
  mockCreateMeta.mockReset();
  mockUpdateMeta.mockReset();
  mockDeleteMeta.mockReset();
  mockCreateMovimento.mockReset();
  mockDeleteMovimento.mockReset();
  mockGetProgresso.mockReset();
  mockListMovimentos.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: USER_ID, role: 'user' };
    next();
  });
  app.use(metasRouter);
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

const metaBase = {
  id: META_ID,
  nome: 'Viagem Europa',
  tipo: 'economia',
  valorAlvo: 10000,
  valorAtual: 2500,
  percentualConcluido: 25,
  valorRestante: 7500,
  status: 'ativa',
  icone: null,
  cor: null,
  observacoes: null,
  dataInicio: '2026-01-01',
  dataFim: null,
  totalMovimentos: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const movimentoBase = {
  id: MOV_ID,
  metaId: META_ID,
  valor: 2500,
  data: '2026-01-15',
  descricao: null,
  movimentacaoId: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

const progressoBase = {
  id: META_ID,
  nome: 'Viagem Europa',
  tipo: 'economia',
  valorAlvo: 10000,
  valorAtual: 2500,
  percentualConcluido: 25,
  valorRestante: 7500,
  status: 'ativa',
  totalMovimentos: 1,
  dataInicio: '2026-01-01',
  dataFim: null,
};
describe('GET /goals', () => {
  test('retorna 200 com shape correto (items, page, limit, total, totalPages)', async () => {
    mockListMetas.mockResolvedValue({ items: [metaBase], page: 1, limit: 20, total: 1, totalPages: 1 });
    const app = makeApp();
    const res = await request(app, 'GET', '/goals', null);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: expect.any(Array), page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(mockListMetas).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ page: 1, limit: 20 }));
  });
  test('passa filtro status=ativa ao serviço', async () => {
    mockListMetas.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    const app = makeApp();
    const res = await request(app, 'GET', '/goals?status=ativa', null);
    expect(res.status).toBe(200);
    expect(mockListMetas).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ status: 'ativa' }));
  });
  test('passa filtro tipo=economia ao serviço', async () => {
    mockListMetas.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    const app = makeApp();
    const res = await request(app, 'GET', '/goals?tipo=economia', null);
    expect(res.status).toBe(200);
    expect(mockListMetas).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ tipo: 'economia' }));
  });
  test('passa filtro busca ao serviço', async () => {
    mockListMetas.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    const app = makeApp();
    const res = await request(app, 'GET', '/goals?busca=viagem', null);
    expect(res.status).toBe(200);
    expect(mockListMetas).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ busca: 'viagem' }));
  });
  test('passa parâmetros de paginação ao serviço', async () => {
    mockListMetas.mockResolvedValue({ items: [], page: 2, limit: 10, total: 0, totalPages: 0 });
    const app = makeApp();
    const res = await request(app, 'GET', '/goals?page=2&limit=10', null);
    expect(res.status).toBe(200);
    expect(mockListMetas).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ page: 2, limit: 10 }));
  });
  test('retorna 422 com status inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/goals?status=invalido', null);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 422 com tipo inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/goals?tipo=invalido', null);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 422 com order_by inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/goals?order_by=invalido', null);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 500 em erro inesperado', async () => {
    mockListMetas.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'GET', '/goals', null);
    expect(res.status).toBe(500);
  });
});
describe('POST /goals', () => {
  const bodyValido = { nome: 'Viagem Europa', tipo: 'economia', valor_alvo: 10000, data_inicio: '2026-01-01' };

  test('retorna 201 com meta criada', async () => {
    mockCreateMeta.mockResolvedValue({ item: metaBase });
    const app = makeApp();
    const res = await request(app, 'POST', '/goals', bodyValido);
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ id: META_ID, nome: 'Viagem Europa' });
  });
  test('retorna 422 quando nome está ausente', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/goals', { ...bodyValido, nome: undefined });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 422 quando valor_alvo é zero ou negativo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/goals', { ...bodyValido, valor_alvo: 0 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 422 quando data_inicio tem formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/goals', { ...bodyValido, data_inicio: '01/01/2026' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 422 quando tipo é inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/goals', { ...bodyValido, tipo: 'invalido' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 422 quando cor não é hex válido (#RRGGBB)', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/goals', { ...bodyValido, cor: 'azul' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('passa userId de req.user.sub, nunca do body', async () => {
    mockCreateMeta.mockResolvedValue({ item: metaBase });
    const app = makeApp();
    await request(app, 'POST', '/goals', { ...bodyValido, userId: 'outro-usuario' });
    expect(mockCreateMeta).toHaveBeenCalledWith(USER_ID, expect.any(Object));
  });
  test('retorna 500 em erro inesperado', async () => {
    mockCreateMeta.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'POST', bodyValido);
    expect(res.status).toBe(500);
  });
});
describe('GET /goals/:id', () => {
  test('retorna 200 com meta e movimentos', async () => {
    mockGetMeta.mockResolvedValue({ item: { ...metaBase, movimentos: [movimentoBase] } });
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}`, null);
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ id: META_ID, movimentos: expect.any(Array) });
  });
  test('retorna 404 quando meta não existe', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockGetMeta.mockRejectedValue(AppError.notFound('Meta não encontrada'));
    const app = makeApp();
    const res = await request(app, 'GET', '/goals/nao-existe', null);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
  test('retorna 500 em erro inesperado', async () => {
    mockGetMeta.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}`, null);
    expect(res.status).toBe(500);
  });
});
describe('PATCH /goals/:id', () => {
  test('retorna 200 com meta atualizada', async () => {
    mockUpdateMeta.mockResolvedValue({ item: { ...metaBase, nome: 'Viagem EUA' } });
    const app = makeApp();
    const res = await request(app, 'PATCH', `/goals/${META_ID}`, { nome: 'Viagem EUA' });
    expect(res.status).toBe(200);
    expect(res.body.item.nome).toBe('Viagem EUA');
  });
  test('retorna 422 com payload inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'PATCH', `/goals/${META_ID}`, { valor_alvo: -100 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 404 quando meta não existe', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockUpdateMeta.mockRejectedValue(AppError.notFound('Meta não encontrada'));
    const app = makeApp();
    const res = await request(app, 'PATCH', '/goals/nao-existe', { nome: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
  test('retorna 500 em erro inesperado', async () => {
    mockUpdateMeta.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'PATCH', `/goals/${META_ID}`, { nome: 'X' });
    expect(res.status).toBe(500);
  });
});
describe('DELETE /goals/:id', () => {
  test('retorna 200 com { deleted: true }', async () => {
    mockDeleteMeta.mockResolvedValue({ deleted: true });
    const app = makeApp();
    const res = await request(app, 'DELETE', `/goals/${META_ID}`, null);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
  });
  test('retorna 404 quando meta não existe', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockDeleteMeta.mockRejectedValue(AppError.notFound('Meta não encontrada'));
    const app = makeApp();
    const res = await request(app, 'DELETE', '/goals/nao-existe', null);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
  test('retorna 500 em erro inesperado', async () => {
    mockDeleteMeta.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'DELETE', `/goals/${META_ID}`, null);
    expect(res.status).toBe(500);
  });
});
describe('GET /goals/:id/progress', () => {
  test('retorna 200 com shape de progresso', async () => {
    mockGetProgresso.mockResolvedValue({ item: progressoBase });
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}/progress`, null);
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({
      id: META_ID,
      nome: expect.any(String),
      tipo: expect.any(String),
      valorAlvo: expect.any(Number),
      valorAtual: expect.any(Number),
      percentualConcluido: expect.any(Number),
      valorRestante: expect.any(Number),
      status: expect.any(String),
      totalMovimentos: expect.any(Number),
      dataInicio: expect.any(String),
    });
  });
  test('retorna 404 quando meta não existe', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockGetProgresso.mockRejectedValue(AppError.notFound('Meta não encontrada'));
    const app = makeApp();
    const res = await request(app, 'GET', '/goals/nao-existe/progress', null);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
  test('retorna 500 em erro inesperado', async () => {
    mockGetProgresso.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}/progress`, null);
    expect(res.status).toBe(500);
  });
});
describe('POST /goals/:id/movements', () => {
  const bodyValido = { valor: 500, data: '2026-02-01' };

  test('retorna 201 com movimento criado', async () => {
    mockCreateMovimento.mockResolvedValue({ item: movimentoBase });
    const app = makeApp();
    const res = await request(app, 'POST', `/goals/${META_ID}/movements`, bodyValido);
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ id: MOV_ID, valor: expect.any(Number) });
  });
  test('retorna 422 quando valor é zero ou negativo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/goals/${META_ID}/movements`, { ...bodyValido, valor: 0 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 422 quando data tem formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/goals/${META_ID}/movements`, { ...bodyValido, data: '01/02/2026' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 422 quando movimentacao_id não é UUID', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/goals/${META_ID}/movements`, { ...bodyValido, movimentacao_id: 'nao-e-uuid' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 404 quando meta não existe', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCreateMovimento.mockRejectedValue(AppError.notFound('Meta não encontrada'));
    const app = makeApp();
    const res = await request(app, 'POST', '/goals/nao-existe/movements', bodyValido);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
  test('passa userId de req.user.sub', async () => {
    mockCreateMovimento.mockResolvedValue({ item: movimentoBase });
    const app = makeApp();
    await request(app, 'POST', `/goals/${META_ID}/movements`, bodyValido);
    expect(mockCreateMovimento).toHaveBeenCalledWith(USER_ID, META_ID, expect.any(Object));
  });
  test('retorna 500 em erro inesperado', async () => {
    mockCreateMovimento.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'POST', `/goals/${META_ID}/movements`, bodyValido);
    expect(res.status).toBe(500);
  });
});
describe('DELETE /goals/:id/movements/:movId', () => {
  test('retorna 200 com { deleted: true }', async () => {
    mockDeleteMovimento.mockResolvedValue({ deleted: true });
    const app = makeApp();
    const res = await request(app, 'DELETE', `/goals/${META_ID}/movements/${MOV_ID}`, null);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
  });
  test('retorna 404 quando movimento não existe', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockDeleteMovimento.mockRejectedValue(AppError.notFound('Movimento não encontrado'));
    const app = makeApp();
    const res = await request(app, 'DELETE', `/goals/${META_ID}/movements/nao-existe`, null);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
  test('retorna 500 em erro inesperado', async () => {
    mockDeleteMovimento.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'DELETE', `/goals/${META_ID}/movements/${MOV_ID}`, null);
    expect(res.status).toBe(500);
  });
});
describe('GET /goals/:id/movements', () => {
  const listResult = { items: [movimentoBase], page: 1, limit: 20, total: 1, totalPages: 1 };

  test('retorna 200 com shape { items, page, limit, total, totalPages }', async () => {
    mockListMovimentos.mockResolvedValue(listResult);
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}/movements`, null);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: expect.any(Array), page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(mockListMovimentos).toHaveBeenCalledWith(USER_ID, META_ID, expect.objectContaining({ page: 1, limit: 20 }));
  });
  test('passa page e limit ao serviço', async () => {
    mockListMovimentos.mockResolvedValue({ ...listResult, page: 2, limit: 10 });
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}/movements?page=2&limit=10`, null);
    expect(res.status).toBe(200);
    expect(mockListMovimentos).toHaveBeenCalledWith(USER_ID, META_ID, expect.objectContaining({ page: 2, limit: 10 }));
  });
  test('passa order_dir ao serviço', async () => {
    mockListMovimentos.mockResolvedValue(listResult);
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}/movements?order_dir=asc`, null);
    expect(res.status).toBe(200);
    expect(mockListMovimentos).toHaveBeenCalledWith(USER_ID, META_ID, expect.objectContaining({ order_dir: 'asc' }));
  });
  test('retorna 422 com order_dir inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}/movements?order_dir=invalido`, null);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
  test('retorna 404 quando meta não existe', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockListMovimentos.mockRejectedValue(AppError.notFound('Meta não encontrada'));
    const app = makeApp();
    const res = await request(app, 'GET', '/goals/nao-existe/movements', null);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
  test('retorna 500 em erro inesperado', async () => {
    mockListMovimentos.mockRejectedValue(new Error('DB error'));
    const app = makeApp();
    const res = await request(app, 'GET', `/goals/${META_ID}/movements`, null);
    expect(res.status).toBe(500);
  });
});