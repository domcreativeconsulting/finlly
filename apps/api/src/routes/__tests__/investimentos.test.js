import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

// Prisma mock functions
const mockPrismaInvestimentoFindFirst = jest.fn();
const mockPrismaEventoFindMany = jest.fn();
const mockPrismaEventoCreate = jest.fn();
const mockPrismaEventoCount = jest.fn();

// express-rate-limit → passthrough em testes
jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
  ipKeyGenerator: (req) => req.ip || '127.0.0.1',
}));

jest.unstable_mockModule('../../utils/rateLimitStore.js', () => ({
  userOrIpKeyGenerator: (req) => req.user?.sub || req.ip || '127.0.0.1',
  buildStore: () => undefined,
}));

// logger
jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// jwtAuthMiddleware
jest.unstable_mockModule('../../middleware/jwtAuth.js', () => ({
  jwtAuthMiddleware: (req, _res, next) => {
    if (!req.user) req.user = { sub: USER_ID, role: 'user' };
    next();
  },
}));

// requireAtivo
jest.unstable_mockModule('../../middleware/requireAtivo.js', () => ({
  requireAtivo: (_req, _res, next) => next(),
}));

// prisma mock
jest.unstable_mockModule('../../utils/database.js', () => ({
  default: {
    investimento: { findFirst: mockPrismaInvestimentoFindFirst },
    investimentoEvento: {
      findMany: mockPrismaEventoFindMany,
      create: mockPrismaEventoCreate,
      count: mockPrismaEventoCount,
    },
  },
}));

let investimentosRouter;
let express;

const USER_ID = 'usuario-uuid-001';
const INVEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENTO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/investimentos.js');
  investimentosRouter = mod.default;
});

beforeEach(() => {
  mockPrismaInvestimentoFindFirst.mockReset();
  mockPrismaEventoFindMany.mockReset();
  mockPrismaEventoCreate.mockReset();
  mockPrismaEventoCount.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: USER_ID, role: 'user' };
    next();
  });
  app.use(investimentosRouter);
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

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const mockInvRow = {
  id: INVEST_ID,
  usuario_id: USER_ID,
  nome: 'Tesouro Direto',
  status: 'ativa',
  data_inicio: new Date('2026-01-01T00:00:00.000Z'),
  deleted_at: null,
};

function makeEventoRow(tipo = 'aporte', overrides = {}) {
  return {
    id: EVENTO_ID,
    investimento_id: INVEST_ID,
    usuario_id: USER_ID,
    tipo,
    valor: 5000.0,
    data: new Date('2026-04-20T00:00:00.000Z'),
    descricao: 'Aporte inicial',
    created_at: new Date('2026-04-20T14:00:00.000Z'),
    updated_at: new Date('2026-04-20T14:00:00.000Z'),
    deleted_at: null,
    ...overrides,
  };
}

const validPostBody = {
  tipo: 'aporte',
  valor: 5000.0,
  data: '2026-04-20',
  descricao: 'Aporte inicial',
};

// ============================================================
// POST /investimentos/:id/eventos
// ============================================================

describe('POST /investimentos/:id/eventos', () => {
  test('AC1: cria evento aporte com sucesso → 201 com shape completo incluindo investmentId e updatedAt', async () => {
    const evRow = makeEventoRow('aporte');
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoCreate.mockResolvedValue(evRow);

    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, validPostBody);

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({
      id: EVENTO_ID,
      investmentId: INVEST_ID,
      type: 'aporte',
      amount: 5000.0,
      date: '2026-04-20',
      description: 'Aporte inicial',
    });
    expect(res.body.item.createdAt).toBeDefined();
    expect(res.body.item.updatedAt).toBeDefined();
  });

  test('AC2: cria evento resgate com sucesso → 201', async () => {
    const evRow = makeEventoRow('resgate', { valor: 1000.0, descricao: 'Resgate parcial' });
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoCreate.mockResolvedValue(evRow);

    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {
      tipo: 'resgate',
      valor: 1000.0,
      data: '2026-04-20',
      descricao: 'Resgate parcial',
    });

    expect(res.status).toBe(201);
    expect(res.body.item.type).toBe('resgate');
    expect(res.body.item.investmentId).toBe(INVEST_ID);
  });

  test('AC3: cria evento rendimento com sucesso → 201', async () => {
    const evRow = makeEventoRow('rendimento', { valor: 120.5, descricao: 'Rendimento mensal' });
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoCreate.mockResolvedValue(evRow);

    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {
      tipo: 'rendimento',
      valor: 120.5,
      data: '2026-04-20',
      descricao: 'Rendimento mensal',
    });

    expect(res.status).toBe(201);
    expect(res.body.item.type).toBe('rendimento');
    expect(res.body.item.amount).toBe(120.5);
  });

  test('AC5: retorna 404 quando investimento não pertence ao usuário', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue(null);

    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, validPostBody);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('AC6a: retorna 422 quando tipo é inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {
      ...validPostBody,
      tipo: 'CONTRIBUTION',
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('AC6b: retorna 422 quando valor é zero', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {
      ...validPostBody,
      valor: 0,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('AC6b: retorna 422 quando valor é negativo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {
      ...validPostBody,
      valor: -100,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('AC6c: retorna 422 quando data tem formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {
      ...validPostBody,
      data: '20/04/2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('AC6d: retorna 422 quando campos obrigatórios estão ausentes', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('AC6e (RF5): retorna 422 quando data do evento é anterior à data_inicio do investimento', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue({
      ...mockInvRow,
      data_inicio: new Date('2026-03-01T00:00:00.000Z'),
    });

    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {
      ...validPostBody,
      data: '2026-01-15',
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/data de início/i);
  });

  test('segurança: userId vem de req.user.sub, nunca do body', async () => {
    const evRow = makeEventoRow('aporte');
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoCreate.mockResolvedValue(evRow);

    const app = makeApp();
    await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, {
      ...validPostBody,
      userId: 'outro-usuario',
    });

    expect(mockPrismaInvestimentoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ usuario_id: USER_ID }) }),
    );
    expect(mockPrismaEventoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuario_id: USER_ID }) }),
    );
  });

  test('retorna 500 em erro interno inesperado', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoCreate.mockRejectedValue(new Error('DB error'));

    const app = makeApp();
    const res = await request(app, 'POST', `/investimentos/${INVEST_ID}/eventos`, validPostBody);

    expect(res.status).toBe(500);
  });
});

// ============================================================
// GET /investimentos/:id/eventos
// ============================================================

describe('GET /investimentos/:id/eventos', () => {
  test('AC4: lista eventos com sucesso → 200 com items incluindo investmentId e updatedAt', async () => {
    const evRow = makeEventoRow('aporte');
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoFindMany.mockResolvedValue([evRow]);
    mockPrismaEventoCount.mockResolvedValue(1);

    const app = makeApp();
    const res = await request(app, 'GET', `/investimentos/${INVEST_ID}/eventos`, null);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: EVENTO_ID,
      investmentId: INVEST_ID,
      type: 'aporte',
      amount: 5000.0,
      date: '2026-04-20',
      description: 'Aporte inicial',
    });
    expect(res.body.items[0].updatedAt).toBeDefined();
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);
  });

  test('AC4: retorna lista vazia quando não há eventos', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoFindMany.mockResolvedValue([]);
    mockPrismaEventoCount.mockResolvedValue(0);

    const app = makeApp();
    const res = await request(app, 'GET', `/investimentos/${INVEST_ID}/eventos`, null);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  test('AC5: retorna 404 quando investimento não pertence ao usuário', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue(null);

    const app = makeApp();
    const res = await request(app, 'GET', `/investimentos/${INVEST_ID}/eventos`, null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('AC7: query usa orderBy [{ data: desc }, { created_at: desc }]', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoFindMany.mockResolvedValue([]);
    mockPrismaEventoCount.mockResolvedValue(0);

    const app = makeApp();
    await request(app, 'GET', `/investimentos/${INVEST_ID}/eventos`, null);

    expect(mockPrismaEventoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ data: 'desc' }, { created_at: 'desc' }],
      }),
    );
  });

  test('filtragem: aceita ?tipo=aporte e repassa ao Prisma', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoFindMany.mockResolvedValue([]);
    mockPrismaEventoCount.mockResolvedValue(0);

    const app = makeApp();
    const res = await request(app, 'GET', `/investimentos/${INVEST_ID}/eventos?tipo=aporte`, null);

    expect(res.status).toBe(200);
    expect(mockPrismaEventoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tipo: 'aporte' }) }),
    );
  });

  test('paginação: aceita ?page=2&perPage=10 e retorna total e totalPages', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoFindMany.mockResolvedValue([]);
    mockPrismaEventoCount.mockResolvedValue(25);

    const app = makeApp();
    const res = await request(app, 'GET', `/investimentos/${INVEST_ID}/eventos?page=2&perPage=10`, null);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.total).toBe(25);
    expect(res.body.totalPages).toBe(3);
    expect(mockPrismaEventoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  test('retorna 422 com tipo inválido no query', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', `/investimentos/${INVEST_ID}/eventos?tipo=INVALIDO`, null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 500 em erro interno inesperado', async () => {
    mockPrismaInvestimentoFindFirst.mockResolvedValue(mockInvRow);
    mockPrismaEventoFindMany.mockRejectedValue(new Error('DB error'));
    mockPrismaEventoCount.mockResolvedValue(0);

    const app = makeApp();
    const res = await request(app, 'GET', `/investimentos/${INVEST_ID}/eventos`, null);

    expect(res.status).toBe(500);
  });
});
