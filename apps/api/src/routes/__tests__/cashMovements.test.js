import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

// Mock service functions
const mockGetExtrato = jest.fn();
const mockPrismaContaFindFirst = jest.fn();
const mockPrismaMovimentacaoCaixaCreate = jest.fn();

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
jest.unstable_mockModule('../../services/extratoService.js', () => ({
  getExtrato: mockGetExtrato,
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

// prisma mock
jest.unstable_mockModule('../../utils/database.js', () => ({
  default: {
    conta: { findFirst: mockPrismaContaFindFirst },
    movimentacaoCaixa: { create: mockPrismaMovimentacaoCaixaCreate },
  },
}));

let cashMovementsRouter;
let express;

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/cashMovements.js');
  cashMovementsRouter = mod.default;
});

beforeEach(() => {
  mockGetExtrato.mockReset();
  mockPrismaContaFindFirst.mockReset();
  mockPrismaMovimentacaoCaixaCreate.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: 'usuario-uuid-001', role: 'user' };
    next();
  });
  app.use(cashMovementsRouter);
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

const CONTA_ID = '22222222-2222-4222-8222-222222222222';
const MOV_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'usuario-uuid-001';

const extratoResponseBase = {
  items: [
    {
      id: MOV_ID,
      accountId: CONTA_ID,
      accountName: 'Conta Corrente',
      type: 'IN',
      amount: 5000,
      date: '2026-04-15',
      description: 'Recebimento: Honorário consultoria',
      originType: 'ACCOUNTS_RECEIVABLE',
      originId: 'uuid-receivable',
      createdAt: '2026-04-15T09:00:00.000Z',
    },
  ],
  page: 1,
  perPage: 20,
  total: 1,
  totalPages: 1,
  totals: {
    totalIn: 5000,
    totalOut: 0,
    balanceDelta: 5000,
  },
};

// ============================================================
// GET /cash-movements
// ============================================================

describe('GET /cash-movements', () => {
  test('retorna 200 com shape correto sem filtros', async () => {
    mockGetExtrato.mockResolvedValue(extratoResponseBase);

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements', null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(extratoResponseBase);
    expect(mockGetExtrato).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ page: 1, perPage: 20, sortBy: 'date', sortOrder: 'desc' }),
    );
  });

  test('repassa filtro type=IN ao serviço', async () => {
    mockGetExtrato.mockResolvedValue(extratoResponseBase);

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?type=IN', null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ type: 'IN' }));
  });

  test('repassa filtro type=OUT ao serviço', async () => {
    mockGetExtrato.mockResolvedValue({ ...extratoResponseBase, items: [] });

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?type=OUT', null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ type: 'OUT' }));
  });

  test('repassa filtros de data ao serviço', async () => {
    mockGetExtrato.mockResolvedValue({ ...extratoResponseBase, items: [] });

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?dateFrom=2026-01-01&dateTo=2026-12-31', null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-12-31' }),
    );
  });

  test('repassa filtro accountId ao serviço', async () => {
    mockGetExtrato.mockResolvedValue(extratoResponseBase);

    const app = makeApp();
    const res = await request(app, 'GET', `/cash-movements?accountId=${CONTA_ID}`, null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ accountId: CONTA_ID }));
  });

  test('repassa filtro originType=ACCOUNTS_PAYABLE ao serviço', async () => {
    mockGetExtrato.mockResolvedValue({ ...extratoResponseBase, items: [] });

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?originType=ACCOUNTS_PAYABLE', null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ originType: 'ACCOUNTS_PAYABLE' }));
  });

  test('repassa filtro originType=MANUAL ao serviço', async () => {
    mockGetExtrato.mockResolvedValue({ ...extratoResponseBase, items: [] });

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?originType=MANUAL', null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ originType: 'MANUAL' }));
  });

  test('repassa parâmetros de ordenação ao serviço', async () => {
    mockGetExtrato.mockResolvedValue(extratoResponseBase);

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?sortBy=amount&sortOrder=asc', null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ sortBy: 'amount', sortOrder: 'asc' }),
    );
  });

  test('repassa parâmetros de paginação ao serviço', async () => {
    mockGetExtrato.mockResolvedValue({ ...extratoResponseBase, page: 2, perPage: 50 });

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?page=2&perPage=50', null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ page: 2, perPage: 50 }));
  });

  test('repassa filtro q ao serviço', async () => {
    mockGetExtrato.mockResolvedValue({ ...extratoResponseBase, items: [] });

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?q=aluguel', null);

    expect(res.status).toBe(200);
    expect(mockGetExtrato).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ q: 'aluguel' }));
  });

  test('retorna 422 com type inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?type=INVALIDO', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 com originType inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?originType=INVALIDO', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 com sortBy inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?sortBy=invalido', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 com accountId não-UUID', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?accountId=nao-uuid', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 com q maior que 100 chars', async () => {
    const app = makeApp();
    const q = 'a'.repeat(101);
    const res = await request(app, 'GET', `/cash-movements?q=${q}`, null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 com dateFrom com formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements?dateFrom=01/01/2026', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 404 quando conta não pertence ao usuário', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockGetExtrato.mockRejectedValue(AppError.notFound('Conta não encontrada'));

    const app = makeApp();
    const res = await request(app, 'GET', `/cash-movements?accountId=${CONTA_ID}`, null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 500 em erro interno inesperado', async () => {
    mockGetExtrato.mockRejectedValue(new Error('DB error'));

    const app = makeApp();
    const res = await request(app, 'GET', '/cash-movements', null);

    expect(res.status).toBe(500);
  });
});

// ============================================================
// POST /cash-movements/manual
// ============================================================

const validManualBody = {
  accountId: CONTA_ID,
  type: 'OUT',
  amount: 180.0,
  date: '2026-04-20',
  description: 'Ajuste manual de despesa',
};

const mockContaRow = { id: CONTA_ID, usuario_id: USER_ID, nome: 'Conta Corrente', deleted_at: null };

const mockMovRow = {
  id: MOV_ID,
  conta_id: CONTA_ID,
  usuario_id: USER_ID,
  tipo: 'saida',
  valor: 180.0,
  descricao: 'Ajuste manual de despesa',
  data: new Date('2026-04-20T00:00:00.000Z'),
  observacoes: null,
  conta_pagar_id: null,
  conta_receber_id: null,
  created_at: new Date('2026-04-20T14:00:00.000Z'),
};

describe('POST /cash-movements/manual', () => {
  test('cria lançamento manual com type=OUT e retorna 201', async () => {
    mockPrismaContaFindFirst.mockResolvedValue(mockContaRow);
    mockPrismaMovimentacaoCaixaCreate.mockResolvedValue(mockMovRow);

    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', validManualBody);

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({
      id: MOV_ID,
      accountId: CONTA_ID,
      type: 'OUT',
      amount: 180.0,
      date: '2026-04-20',
      description: 'Ajuste manual de despesa',
      originType: 'MANUAL',
    });
    expect(res.body.item.createdAt).toBeDefined();
  });

  test('cria lançamento manual com type=IN e retorna 201', async () => {
    const movIN = { ...mockMovRow, tipo: 'entrada' };
    mockPrismaContaFindFirst.mockResolvedValue(mockContaRow);
    mockPrismaMovimentacaoCaixaCreate.mockResolvedValue(movIN);

    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', { ...validManualBody, type: 'IN' });

    expect(res.status).toBe(201);
    expect(res.body.item.type).toBe('IN');
    expect(res.body.item.originType).toBe('MANUAL');
  });

  test('cria lançamento com notes opcional', async () => {
    const movWithNotes = { ...mockMovRow, observacoes: 'Obs teste' };
    mockPrismaContaFindFirst.mockResolvedValue(mockContaRow);
    mockPrismaMovimentacaoCaixaCreate.mockResolvedValue(movWithNotes);

    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', { ...validManualBody, notes: 'Obs teste' });

    expect(res.status).toBe(201);
    expect(mockPrismaMovimentacaoCaixaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ observacoes: 'Obs teste' }) }),
    );
  });

  test('retorna 403 quando conta não pertence ao usuário', async () => {
    mockPrismaContaFindFirst.mockResolvedValue(null);

    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', validManualBody);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('retorna 422 quando accountId não é UUID', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', { ...validManualBody, accountId: 'nao-uuid' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando type é inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', { ...validManualBody, type: 'TRANSFER' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando amount é zero ou negativo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', { ...validManualBody, amount: 0 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando date tem formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', { ...validManualBody, date: '20/04/2026' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando description está vazia', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', { ...validManualBody, description: '' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando campos obrigatórios estão ausentes', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', {});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('passa userId de req.user.sub, nunca do body', async () => {
    mockPrismaContaFindFirst.mockResolvedValue(mockContaRow);
    mockPrismaMovimentacaoCaixaCreate.mockResolvedValue(mockMovRow);

    const app = makeApp();
    await request(app, 'POST', '/cash-movements/manual', { ...validManualBody, userId: 'outro-usuario' });

    expect(mockPrismaContaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ usuario_id: USER_ID }) }),
    );
    expect(mockPrismaMovimentacaoCaixaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usuario_id: USER_ID }) }),
    );
  });

  test('retorna 500 em erro interno inesperado', async () => {
    mockPrismaContaFindFirst.mockResolvedValue(mockContaRow);
    mockPrismaMovimentacaoCaixaCreate.mockRejectedValue(new Error('DB error'));

    const app = makeApp();
    const res = await request(app, 'POST', '/cash-movements/manual', validManualBody);

    expect(res.status).toBe(500);
  });
});
