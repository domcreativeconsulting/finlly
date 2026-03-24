import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

// Mock service functions
const mockListContasPagar = jest.fn();
const mockGetContaPagar = jest.fn();
const mockCreateContaPagar = jest.fn();
const mockUpdateContaPagar = jest.fn();
const mockDeleteContaPagar = jest.fn();
const mockPagarContaPagar = jest.fn();
const mockCancelarContaPagar = jest.fn();
const mockGetGrupoParcelas = jest.fn();
const mockCancelarGrupoParcelas = jest.fn();

// express-rate-limit → passthrough em testes
jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

// Service mock
jest.unstable_mockModule('../../services/contasPagarService.js', () => ({
  listContasPagar: mockListContasPagar,
  getContaPagar: mockGetContaPagar,
  createContaPagar: mockCreateContaPagar,
  updateContaPagar: mockUpdateContaPagar,
  deleteContaPagar: mockDeleteContaPagar,
  pagarContaPagar: mockPagarContaPagar,
  cancelarContaPagar: mockCancelarContaPagar,
  getGrupoParcelas: mockGetGrupoParcelas,
  cancelarGrupoParcelas: mockCancelarGrupoParcelas,
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

let contasPagarRouter;
let express;

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
  mockPagarContaPagar.mockReset();
  mockCancelarContaPagar.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: 'usuario-uuid-001', role: 'user' };
    next();
  });
  app.use(contasPagarRouter);
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

const contaBase = {
  id: 'conta-uuid-001',
  usuario_id: 'usuario-uuid-001',
  descricao: 'Aluguel',
  valor: 1500,
  data_vencimento: '2025-01-01T00:00:00.000Z',
  status: 'pendente',
  categoria_id: null,
  conta_id: null,
  recorrente: false,
  recorrencia: null,
  parcela_atual: null,
  total_parcelas: null,
  grupo_recorrencia_id: null,
  observacoes: null,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  deleted_at: null,
  categoria: null,
  conta: null,
};

// ============================================================
// GET /contas-pagar
// ============================================================

describe('GET /contas-pagar', () => {
  test('retorna 200 com lista paginada', async () => {
    const resultado = { data: [contaBase], total: 1, page: 1, totalPages: 1 };
    mockListContasPagar.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar', null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resultado);
    expect(mockListContasPagar).toHaveBeenCalledWith('usuario-uuid-001', expect.objectContaining({ page: 1, limit: 20 }));
  });

  test('retorna 200 passando filtro busca', async () => {
    const resultado = { data: [contaBase], total: 1, page: 1, totalPages: 1 };
    mockListContasPagar.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar?busca=Aluguel', null);

    expect(res.status).toBe(200);
    expect(mockListContasPagar).toHaveBeenCalledWith(
      'usuario-uuid-001',
      expect.objectContaining({ busca: 'Aluguel' }),
    );
  });

  test('retorna 200 passando filtros de status e data', async () => {
    const resultado = { data: [], total: 0, page: 1, totalPages: 0 };
    mockListContasPagar.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar?status=pendente&data_vencimento_de=2025-01-01&data_vencimento_ate=2025-12-31', null);

    expect(res.status).toBe(200);
    expect(mockListContasPagar).toHaveBeenCalledWith(
      'usuario-uuid-001',
      expect.objectContaining({ status: 'pendente', data_vencimento_de: '2025-01-01', data_vencimento_ate: '2025-12-31' }),
    );
  });

  test('retorna 422 com busca maior que 100 chars', async () => {
    const app = makeApp();
    const busca = 'a'.repeat(101);
    const res = await request(app, 'GET', `/contas-pagar?busca=${busca}`, null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 com status inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar?status=invalido', null);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ============================================================
// GET /contas-pagar/:id
// ============================================================

describe('GET /contas-pagar/:id', () => {
  test('retorna 200 com conta quando encontrada', async () => {
    mockGetContaPagar.mockResolvedValue(contaBase);

    const app = makeApp();
    const res = await request(app, 'GET', '/contas-pagar/conta-uuid-001', null);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(contaBase);
    expect(mockGetContaPagar).toHaveBeenCalledWith('conta-uuid-001', 'usuario-uuid-001');
  });

  test('retorna 404 quando conta não encontrada', async () => {
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
    data_vencimento: '2025-01-01',
  };

  test('retorna 201 com conta criada para body válido', async () => {
    mockCreateContaPagar.mockResolvedValue(contaBase);

    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', bodyValido);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(contaBase);
    expect(mockCreateContaPagar).toHaveBeenCalledWith('usuario-uuid-001', expect.objectContaining({ descricao: 'Aluguel', valor: 1500 }));
  });

  test('retorna 422 quando descricao está ausente', async () => {
    const app = makeApp();
    const { descricao: _d, ...semDescricao } = bodyValido;
    const res = await request(app, 'POST', '/contas-pagar', semDescricao);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando valor é negativo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', { ...bodyValido, valor: -100 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando data_vencimento tem formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', { ...bodyValido, data_vencimento: '01/01/2025' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 201 com parcelamento quando total_parcelas fornecido', async () => {
    const resultadoParcelado = {
      parcelas: 3,
      grupo_recorrencia_id: 'grupo-uuid-001',
      data: [{ ...contaBase, parcela_atual: 1, total_parcelas: 3 }],
    };
    mockCreateContaPagar.mockResolvedValue(resultadoParcelado);

    const bodyParcelado = { ...bodyValido, total_parcelas: 3, recorrencia: 'mensal' };
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', bodyParcelado);

    expect(res.status).toBe(201);
    expect(res.body.parcelas).toBe(3);
    expect(res.body.grupo_recorrencia_id).toBe('grupo-uuid-001');
    expect(mockCreateContaPagar).toHaveBeenCalledWith(
      'usuario-uuid-001',
      expect.objectContaining({ total_parcelas: 3, recorrencia: 'mensal' }),
    );
  });

  test('retorna 422 quando total_parcelas é menor que 2', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', { ...bodyValido, total_parcelas: 1 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 422 quando recorrencia tem valor inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar', { ...bodyValido, total_parcelas: 3, recorrencia: 'invalido' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ============================================================
// PUT /contas-pagar/:id
// ============================================================

describe('PUT /contas-pagar/:id', () => {
  test('retorna 200 com conta atualizada', async () => {
    mockUpdateContaPagar.mockResolvedValue({ ...contaBase, descricao: 'Atualizado' });

    const app = makeApp();
    const res = await request(app, 'PUT', '/contas-pagar/conta-uuid-001', { descricao: 'Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.descricao).toBe('Atualizado');
    expect(mockUpdateContaPagar).toHaveBeenCalledWith('conta-uuid-001', 'usuario-uuid-001', expect.objectContaining({ descricao: 'Atualizado' }));
  });

  test('retorna 422 quando body está vazio', async () => {
    const app = makeApp();
    const res = await request(app, 'PUT', '/contas-pagar/conta-uuid-001', {});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 404 quando conta não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockUpdateContaPagar.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'PUT', '/contas-pagar/nao-existe', { descricao: 'Teste' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 400 quando conta já está paga', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockUpdateContaPagar.mockRejectedValue(AppError.badRequest('Não é possível editar uma conta já paga'));

    const app = makeApp();
    const res = await request(app, 'PUT', '/contas-pagar/conta-uuid-001', { descricao: 'Teste' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});

// ============================================================
// PATCH /contas-pagar/:id
// ============================================================

describe('PATCH /contas-pagar/:id', () => {
  test('retorna 200 com conta atualizada (alias semântico para PUT)', async () => {
    mockUpdateContaPagar.mockResolvedValue({ ...contaBase, valor: 2000 });

    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/conta-uuid-001', { valor: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.valor).toBe(2000);
    expect(mockUpdateContaPagar).toHaveBeenCalledWith('conta-uuid-001', 'usuario-uuid-001', expect.objectContaining({ valor: 2000 }));
  });

  test('retorna 422 quando body está vazio', async () => {
    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/conta-uuid-001', {});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ============================================================
// POST /contas-pagar/:id/pagar
// ============================================================

describe('POST /contas-pagar/:id/pagar', () => {
  test('retorna 200 com conta marcada como paga (sem body)', async () => {
    const contaPaga = { ...contaBase, status: 'pago', data_pagamento: '2025-01-15T00:00:00.000Z' };
    mockPagarContaPagar.mockResolvedValue(contaPaga);

    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar/conta-uuid-001/pagar', {});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pago');
    expect(mockPagarContaPagar).toHaveBeenCalledWith('conta-uuid-001', 'usuario-uuid-001', expect.any(Object));
  });

  test('retorna 200 com data_pagamento customizada', async () => {
    const contaPaga = { ...contaBase, status: 'pago', data_pagamento: '2025-01-10T00:00:00.000Z' };
    mockPagarContaPagar.mockResolvedValue(contaPaga);

    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar/conta-uuid-001/pagar', {
      data_pagamento: '2025-01-10',
    });

    expect(res.status).toBe(200);
    expect(mockPagarContaPagar).toHaveBeenCalledWith(
      'conta-uuid-001',
      'usuario-uuid-001',
      expect.objectContaining({ data_pagamento: '2025-01-10' }),
    );
  });

  test('retorna 422 quando data_pagamento tem formato inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar/conta-uuid-001/pagar', { data_pagamento: 'invalido' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 200 com conta_id válido no body (cria movimentação)', async () => {
    const contaPaga = { ...contaBase, status: 'pago', data_pagamento: '2025-01-15T00:00:00.000Z' };
    mockPagarContaPagar.mockResolvedValue(contaPaga);

    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar/conta-uuid-001/pagar', {
      conta_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pago');
    expect(mockPagarContaPagar).toHaveBeenCalledWith(
      'conta-uuid-001',
      'usuario-uuid-001',
      expect.objectContaining({ conta_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }),
    );
  });

  test('retorna 422 quando conta_id não é UUID válido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar/conta-uuid-001/pagar', { conta_id: 'nao-e-uuid' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('retorna 404 quando conta não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockPagarContaPagar.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar/nao-existe/pagar', {});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 400 quando conta já está paga', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockPagarContaPagar.mockRejectedValue(AppError.badRequest('Conta a pagar já está paga'));

    const app = makeApp();
    const res = await request(app, 'POST', '/contas-pagar/conta-uuid-001/pagar', {});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.message).toBe('Conta a pagar já está paga');
  });
});

// ============================================================
// PATCH /contas-pagar/:id/cancelar
// ============================================================

describe('PATCH /contas-pagar/:id/cancelar', () => {
  test('retorna 200 com conta cancelada', async () => {
    const contaCancelada = { ...contaBase, status: 'cancelado' };
    mockCancelarContaPagar.mockResolvedValue(contaCancelada);

    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/conta-uuid-001/cancelar', null);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelado');
    expect(mockCancelarContaPagar).toHaveBeenCalledWith('conta-uuid-001', 'usuario-uuid-001');
  });

  test('retorna 404 quando conta não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCancelarContaPagar.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/nao-existe/cancelar', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 400 quando conta já está paga', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCancelarContaPagar.mockRejectedValue(AppError.badRequest('Não é possível cancelar uma conta já paga'));

    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/conta-uuid-001/cancelar', null);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.message).toBe('Não é possível cancelar uma conta já paga');
  });

  test('retorna 400 quando conta já está cancelada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockCancelarContaPagar.mockRejectedValue(AppError.badRequest('Conta a pagar já está cancelada'));

    const app = makeApp();
    const res = await request(app, 'PATCH', '/contas-pagar/conta-uuid-001/cancelar', null);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.message).toBe('Conta a pagar já está cancelada');
  });
});

// ============================================================
// DELETE /contas-pagar/:id
// ============================================================

describe('DELETE /contas-pagar/:id', () => {
  test('retorna 204 quando exclusão bem-sucedida', async () => {
    mockDeleteContaPagar.mockResolvedValue(undefined);

    const app = makeApp();
    const res = await request(app, 'DELETE', '/contas-pagar/conta-uuid-001', null);

    expect(res.status).toBe(204);
    expect(mockDeleteContaPagar).toHaveBeenCalledWith('conta-uuid-001', 'usuario-uuid-001');
  });

  test('retorna 404 quando conta não encontrada', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockDeleteContaPagar.mockRejectedValue(AppError.notFound('Conta a pagar não encontrada'));

    const app = makeApp();
    const res = await request(app, 'DELETE', '/contas-pagar/nao-existe', null);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('retorna 400 quando conta já está paga', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockDeleteContaPagar.mockRejectedValue(AppError.badRequest('Não é possível excluir uma conta já paga'));

    const app = makeApp();
    const res = await request(app, 'DELETE', '/contas-pagar/conta-uuid-001', null);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.message).toBe('Não é possível excluir uma conta já paga');
  });
});
