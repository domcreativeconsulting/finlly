import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

// Mock service functions
const mockListMovimentacoes = jest.fn();
const mockGetMovimentacao = jest.fn();
const mockCreateMovimentacao = jest.fn();
const mockUpdateMovimentacao = jest.fn();
const mockDeleteMovimentacao = jest.fn();
const mockGetSaldoConta = jest.fn();
const mockGetSaldoConsolidado = jest.fn();

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
jest.unstable_mockModule('../../services/movimentacoesService.js', () => ({
  listMovimentacoes: mockListMovimentacoes,
  getMovimentacao: mockGetMovimentacao,
  createMovimentacao: mockCreateMovimentacao,
  updateMovimentacao: mockUpdateMovimentacao,
  deleteMovimentacao: mockDeleteMovimentacao,
  getSaldoConta: mockGetSaldoConta,
  getSaldoConsolidado: mockGetSaldoConsolidado,
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

jest.unstable_mockModule('../../middleware/auditoria.js', () => ({
  auditarAcao: () => (_req, _res, next) => next(),
}));

let movimentacoesRouter;
let express;

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/movimentacoes.js');
  movimentacoesRouter = mod.default;
});

beforeEach(() => {
  mockListMovimentacoes.mockReset();
  mockGetMovimentacao.mockReset();
  mockCreateMovimentacao.mockReset();
  mockUpdateMovimentacao.mockReset();
  mockDeleteMovimentacao.mockReset();
  mockGetSaldoConta.mockReset();
  mockGetSaldoConsolidado.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: 'usuario-uuid-001', role: 'user' };
    next();
  });
  app.use(movimentacoesRouter);
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

const MOV_ID = '11111111-1111-4111-8111-111111111111';
const CONTA_ID = '22222222-2222-4222-8222-222222222222';
const CONTA_DESTINO_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = 'usuario-uuid-001';

const movimentacaoBase = {
  id: MOV_ID,
  usuario_id: USER_ID,
  conta_id: CONTA_ID,
  tipo: 'entrada',
  valor: 500,
  descricao: 'Recebimento cliente',
  data: '2025-01-01T00:00:00.000Z',
  categoria_id: null,
  conta_destino_id: null,
  conta_pagar_id: null,
  conta_receber_id: null,
  observacoes: null,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  deleted_at: null,
  categoria: null,
  conta: { nome: 'Conta Corrente' },
  conta_destino: null,
};

// ============================================================
// GET /movimentacoes
// ============================================================

const PAYABLE_ID = '55555555-5555-4555-8555-555555555555';
const RECEIVABLE_ID = '66666666-6666-4666-8666-666666666666';

const externalMovBase = {
  id: MOV_ID,
  accountId: CONTA_ID,
  accountName: 'Conta Corrente',
  type: 'IN',
  amount: 500,
  date: '2025-01-01',
  description: 'Recebimento cliente',
  originType: 'MANUAL',
  originId: null,
  createdAt: '2025-01-01T00:00:00.000Z',
};

describe('GET /movimentacoes', () => {
  // AC1: Returns only authenticated user's movimentações
  test('AC1: retorna 200 com items do usuário autenticado', async () => {
    const resultado = { items: [externalMovBase], page: 1, perPage: 20, total: 1, totalPages: 1 };
    mockListMovimentacoes.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes', null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resultado);
    expect(mockListMovimentacoes).toHaveBeenCalledWith('usuario-uuid-001', expect.objectContaining({ page: 1, perPage: 20 }));
  });

  // AC2: Filter by accountId works; accountId from another user returns 403
  test('AC2: filtro por accountId é passado ao serviço', async () => {
    const resultado = { items: [externalMovBase], page: 1, perPage: 20, total: 1, totalPages: 1 };
    mockListMovimentacoes.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', `/movimentacoes?accountId=${CONTA_ID}`, null);

    expect(res.status).toBe(200);
    expect(mockListMovimentacoes).toHaveBeenCalledWith(
      'usuario-uuid-001',
      expect.objectContaining({ accountId: CONTA_ID }),
    );
  });

  test('AC2: accountId de outro usuário retorna 403', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockListMovimentacoes.mockRejectedValue(AppError.forbidden('Conta não pertence ao usuário'));

    const app = makeApp();
    const res = await request(app, 'GET', `/movimentacoes?accountId=${CONTA_ID}`, null);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  // AC3: Pagination returns items, page, perPage, total, totalPages
  test('AC3: paginação retorna envelope correto', async () => {
    const resultado = { items: [externalMovBase], page: 2, perPage: 10, total: 58, totalPages: 6 };
    mockListMovimentacoes.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes?page=2&perPage=10', null);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: expect.any(Array), page: 2, perPage: 10, total: 58, totalPages: 6 });
    expect(mockListMovimentacoes).toHaveBeenCalledWith(
      'usuario-uuid-001',
      expect.objectContaining({ page: 2, perPage: 10 }),
    );
  });

  // AC4: sortBy=amount&sortOrder=asc sorts correctly
  test('AC4: sortBy=amount&sortOrder=asc é passado ao serviço mapeado', async () => {
    const resultado = { items: [], page: 1, perPage: 20, total: 0, totalPages: 0 };
    mockListMovimentacoes.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes?sortBy=amount&sortOrder=asc', null);

    expect(res.status).toBe(200);
    expect(mockListMovimentacoes).toHaveBeenCalledWith(
      'usuario-uuid-001',
      expect.objectContaining({ sortBy: 'amount', sortOrder: 'asc' }),
    );
  });

  // AC5: Default period applied when dateFrom/dateTo omitted
  test('AC5: período padrão aplicado quando dateFrom/dateTo omitidos', async () => {
    const resultado = { items: [], page: 1, perPage: 20, total: 0, totalPages: 0 };
    mockListMovimentacoes.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes', null);

    expect(res.status).toBe(200);
    // dateFrom and dateTo should be undefined (service applies defaults internally)
    expect(mockListMovimentacoes).toHaveBeenCalledWith(
      'usuario-uuid-001',
      expect.objectContaining({ dateFrom: undefined, dateTo: undefined }),
    );
  });

  // AC6: originType ACCOUNTS_PAYABLE / ACCOUNTS_RECEIVABLE / MANUAL correct
  test('AC6: originType ACCOUNTS_PAYABLE retornado pelo serviço', async () => {
    const movPayable = { ...externalMovBase, originType: 'ACCOUNTS_PAYABLE', originId: PAYABLE_ID };
    const resultado = { items: [movPayable], page: 1, perPage: 20, total: 1, totalPages: 1 };
    mockListMovimentacoes.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes', null);

    expect(res.status).toBe(200);
    expect(res.body.items[0].originType).toBe('ACCOUNTS_PAYABLE');
    expect(res.body.items[0].originId).toBe(PAYABLE_ID);
  });

  test('AC6: originType ACCOUNTS_RECEIVABLE retornado pelo serviço', async () => {
    const movReceivable = { ...externalMovBase, originType: 'ACCOUNTS_RECEIVABLE', originId: RECEIVABLE_ID };
    const resultado = { items: [movReceivable], page: 1, perPage: 20, total: 1, totalPages: 1 };
    mockListMovimentacoes.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes', null);

    expect(res.status).toBe(200);
    expect(res.body.items[0].originType).toBe('ACCOUNTS_RECEIVABLE');
  });

  test('AC6: originType MANUAL retornado pelo serviço', async () => {
    const resultado = { items: [externalMovBase], page: 1, perPage: 20, total: 1, totalPages: 1 };
    mockListMovimentacoes.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes', null);

    expect(res.status).toBe(200);
    expect(res.body.items[0].originType).toBe('MANUAL');
  });

  // AC7: Invalid dateFrom returns 422
  test('AC7: dateFrom inválido retorna 422', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes?dateFrom=31-01-2026', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('AC7: dateTo inválido retorna 422', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes?dateTo=not-a-date', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('accountId inválido (não uuid) retorna 422', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes?accountId=nao-uuid', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('sortBy inválido retorna 422', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes?sortBy=invalido', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ============================================================
// GET /movimentacoes/saldo
// ============================================================

describe('GET /movimentacoes/saldo', () => {
  test('retorna 200 com saldo consolidado', async () => {
    const resultado = { saldo: 1000, entradas: 1500, saidas: 500, contas: [CONTA_ID] };
    mockGetSaldoConsolidado.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes/saldo', null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resultado);
    expect(mockGetSaldoConsolidado).toHaveBeenCalledWith('usuario-uuid-001');
  });
});

// ============================================================
// GET /movimentacoes/saldo/:contaId
// ============================================================

describe('GET /movimentacoes/saldo/:contaId', () => {
  test('retorna 200 com saldo da conta', async () => {
    const resultado = { conta_id: CONTA_ID, nome: 'Conta Corrente', entradas: 1000, saidas: 300, saldo: 700 };
    mockGetSaldoConta.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', `/movimentacoes/saldo/${CONTA_ID}`, null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resultado);
    expect(mockGetSaldoConta).toHaveBeenCalledWith(CONTA_ID, USER_ID);
  });

  test('retorna 404 quando conta não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockGetSaldoConta.mockRejectedValue(AppError.notFound('Conta não encontrada'));

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes/saldo/conta-inexistente', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ============================================================
// GET /movimentacoes/:id
// ============================================================

describe('GET /movimentacoes/:id', () => {
  test('retorna 200 com movimentação quando encontrada', async () => {
    mockGetMovimentacao.mockResolvedValue(movimentacaoBase);

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes/mov-uuid-001', null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(movimentacaoBase);
    expect(mockGetMovimentacao).toHaveBeenCalledWith('mov-uuid-001', 'usuario-uuid-001');
  });

  test('retorna 404 quando movimentação não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockGetMovimentacao.mockRejectedValue(AppError.notFound('Movimentação não encontrada'));

    const app = makeApp();
    const res = await request(app, 'GET', '/movimentacoes/nao-existe', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ============================================================
// POST /movimentacoes
// ============================================================

describe('POST /movimentacoes', () => {
  const bodyEntradaValido = {
    conta_id: CONTA_ID,
    tipo: 'entrada',
    valor: 500,
    descricao: 'Recebimento cliente',
    data: '2025-01-01',
  };

  test('retorna 201 com movimentação criada para body válido', async () => {
    mockCreateMovimentacao.mockResolvedValue(movimentacaoBase);

    const app = makeApp();
    const res = await request(app, 'POST', '/movimentacoes', bodyEntradaValido);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(movimentacaoBase);
    expect(mockCreateMovimentacao).toHaveBeenCalledWith('usuario-uuid-001', expect.objectContaining({ tipo: 'entrada', valor: 500 }));
  });

  test('retorna 422 quando conta_id está ausente', async () => {
    const app = makeApp();
    const { conta_id: _c, ...semContaId } = bodyEntradaValido;
    const res = await request(app, 'POST', '/movimentacoes', semContaId);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando valor é negativo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/movimentacoes', { ...bodyEntradaValido, valor: -100 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando tipo é inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/movimentacoes', { ...bodyEntradaValido, tipo: 'invalido' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando data tem formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/movimentacoes', { ...bodyEntradaValido, data: '01/01/2025' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 para transferencia sem conta_destino_id', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/movimentacoes', { ...bodyEntradaValido, tipo: 'transferencia' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 para transferencia com conta_destino_id igual a conta_id', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/movimentacoes', {
      ...bodyEntradaValido,
      tipo: 'transferencia',
      conta_destino_id: CONTA_ID,
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 201 para transferencia válida', async () => {
    const transferencia = {
      saida: { ...movimentacaoBase, tipo: 'saida' },
      entrada: { ...movimentacaoBase, id: '44444444-4444-4444-4444-444444444444', tipo: 'entrada', conta_id: CONTA_DESTINO_ID },
    };
    mockCreateMovimentacao.mockResolvedValue(transferencia);

    const app = makeApp();
    const res = await request(app, 'POST', '/movimentacoes', {
      ...bodyEntradaValido,
      tipo: 'transferencia',
      conta_destino_id: CONTA_DESTINO_ID,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(transferencia);
  });
});

// ============================================================
// PUT /movimentacoes/:id
// ============================================================

describe('PUT /movimentacoes/:id', () => {
  test('retorna 200 com movimentação atualizada', async () => {
    const atualizada = { ...movimentacaoBase, descricao: 'Novo nome' };
    mockUpdateMovimentacao.mockResolvedValue(atualizada);

    const app = makeApp();
    const res = await request(app, 'PUT', '/movimentacoes/mov-uuid-001', { descricao: 'Novo nome' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(atualizada);
    expect(mockUpdateMovimentacao).toHaveBeenCalledWith('mov-uuid-001', 'usuario-uuid-001', expect.objectContaining({ descricao: 'Novo nome' }));
  });

  test('retorna 422 quando body está vazio', async () => {
    const app = makeApp();
    const res = await request(app, 'PUT', '/movimentacoes/mov-uuid-001', {});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 400 quando movimentação é de baixa', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockUpdateMovimentacao.mockRejectedValue(AppError.badRequest('Movimentações geradas por baixas não podem ser editadas manualmente'));

    const app = makeApp();
    const res = await request(app, 'PUT', '/movimentacoes/mov-uuid-001', { descricao: 'Teste' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});

// ============================================================
// PATCH /movimentacoes/:id
// ============================================================

describe('PATCH /movimentacoes/:id', () => {
  test('retorna 200 com movimentação atualizada via PATCH', async () => {
    const atualizada = { ...movimentacaoBase, valor: 999 };
    mockUpdateMovimentacao.mockResolvedValue(atualizada);

    const app = makeApp();
    const res = await request(app, 'PATCH', '/movimentacoes/mov-uuid-001', { valor: 999 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(atualizada);
  });
});

// ============================================================
// DELETE /movimentacoes/:id
// ============================================================

describe('DELETE /movimentacoes/:id', () => {
  test('retorna 204 ao excluir movimentação manual', async () => {
    mockDeleteMovimentacao.mockResolvedValue(undefined);

    const app = makeApp();
    const res = await request(app, 'DELETE', '/movimentacoes/mov-uuid-001', null);

    expect(res.status).toBe(204);
    expect(mockDeleteMovimentacao).toHaveBeenCalledWith('mov-uuid-001', 'usuario-uuid-001');
  });

  test('retorna 404 quando movimentação não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockDeleteMovimentacao.mockRejectedValue(AppError.notFound('Movimentação não encontrada'));

    const app = makeApp();
    const res = await request(app, 'DELETE', '/movimentacoes/nao-existe', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 400 quando movimentação é de baixa', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockDeleteMovimentacao.mockRejectedValue(AppError.badRequest('Movimentações geradas por baixas não podem ser excluídas manualmente'));

    const app = makeApp();
    const res = await request(app, 'DELETE', '/movimentacoes/mov-uuid-001', null);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});
