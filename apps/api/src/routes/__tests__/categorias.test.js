import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

// Mock service functions
const mockListCategorias = jest.fn();
const mockGetCategoria = jest.fn();
const mockCreateCategoria = jest.fn();
const mockUpdateCategoria = jest.fn();
const mockDeleteCategoria = jest.fn();

// express-rate-limit → passthrough em testes
jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
  ipKeyGenerator: (req) => req.ip || '127.0.0.1',
}));

jest.unstable_mockModule('../../utils/rateLimitStore.js', () => ({
  userOrIpKeyGenerator: (req) => req.user?.sub || req.ip || '127.0.0.1',
  buildStore: () => undefined,
}));

// Service mock
jest.unstable_mockModule('../../services/categoriaService.js', () => ({
  listCategorias: mockListCategorias,
  getCategoria: mockGetCategoria,
  createCategoria: mockCreateCategoria,
  updateCategoria: mockUpdateCategoria,
  deleteCategoria: mockDeleteCategoria,
}));

// logger
jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// jwtAuthMiddleware
jest.unstable_mockModule('../../middleware/jwtAuth.js', () => ({
  jwtAuthMiddleware: (req, _res, next) => {
    if (!req.user) {
      req.user = { sub: 'usuario-uuid-001', role: 'user' };
    }
    next();
  },
}));

// requireAtivo
jest.unstable_mockModule('../../middleware/requireAtivo.js', () => ({
  requireAtivo: (_req, _res, next) => next(),
}));

let categoriasRouter;
let express;

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/categorias.js');
  categoriasRouter = mod.default;
});

beforeEach(() => {
  mockListCategorias.mockReset();
  mockGetCategoria.mockReset();
  mockCreateCategoria.mockReset();
  mockUpdateCategoria.mockReset();
  mockDeleteCategoria.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: 'usuario-uuid-001', role: 'user' };
    next();
  });
  app.use(categoriasRouter);
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

const categoriaBase = {
  id: 'cat-uuid-001',
  usuario_id: 'usuario-uuid-001',
  nome: 'Salário',
  tipo: 'entrada',
  icone: null,
  cor: null,
  pai_id: null,
  is_sistema: false,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  deleted_at: null,
};

// ============================================================
// POST /categorias
// ============================================================

describe('POST /categorias', () => {
  test('retorna 201 ao criar categoria com dados válidos', async () => {
    mockCreateCategoria.mockResolvedValue(categoriaBase);

    const app = makeApp();
    const res = await request(app, 'POST', '/categorias', { nome: 'Salário', tipo: 'entrada' });

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe('Salário');
    expect(mockCreateCategoria).toHaveBeenCalledWith('usuario-uuid-001', expect.objectContaining({ nome: 'Salário', tipo: 'entrada' }));
  });

  test('retorna 409 com code CONFLICT ao criar categoria com nome+tipo duplicado', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCreateCategoria.mockRejectedValue(
      AppError.conflict('Já existe uma categoria "Salário" do tipo "entrada" para este usuário'),
    );

    const app = makeApp();
    const res = await request(app, 'POST', '/categorias', { nome: 'Salário', tipo: 'entrada' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
    expect(res.body.message).toMatch(/Salário/);
  });

  test('retorna 422 ao omitir campo obrigatório', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/categorias', { nome: 'Salário' }); // faltando tipo

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 com tipo inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/categorias', { nome: 'Salário', tipo: 'invalido' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ============================================================
// PUT /categorias/:id
// ============================================================

describe('PUT /categorias/:id', () => {
  test('retorna 200 ao atualizar categoria com dados válidos', async () => {
    const atualizada = { ...categoriaBase, nome: 'Freelance' };
    mockUpdateCategoria.mockResolvedValue(atualizada);

    const app = makeApp();
    const res = await request(app, 'PUT', '/categorias/cat-uuid-001', { nome: 'Freelance' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Freelance');
    expect(mockUpdateCategoria).toHaveBeenCalledWith('cat-uuid-001', 'usuario-uuid-001', expect.objectContaining({ nome: 'Freelance' }));
  });

  test('retorna 409 com code CONFLICT ao renomear para nome+tipo já existente', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockUpdateCategoria.mockRejectedValue(
      AppError.conflict('Já existe uma categoria "Freelance" do tipo "entrada" para este usuário'),
    );

    const app = makeApp();
    const res = await request(app, 'PUT', '/categorias/cat-uuid-001', { nome: 'Freelance' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
    expect(res.body.message).toMatch(/Freelance/);
  });

  test('retorna 422 quando nenhum campo é fornecido', async () => {
    const app = makeApp();
    const res = await request(app, 'PUT', '/categorias/cat-uuid-001', {});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
