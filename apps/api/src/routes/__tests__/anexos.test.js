import { jest } from '@jest/globals';

// ---- mocks ----
const mockUploadAnexo = jest.fn();
const mockListarAnexos = jest.fn();
const mockBuscarAnexoPorId = jest.fn();
const mockDeletarAnexo = jest.fn();
const mockVincularAnexo = jest.fn();
const mockDesvincularAnexo = jest.fn();
const mockBuscarOcrResultado = jest.fn();

jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../services/anexoService.js', () => ({
  uploadAnexo: mockUploadAnexo,
  listarAnexos: mockListarAnexos,
  buscarAnexoPorId: mockBuscarAnexoPorId,
  deletarAnexo: mockDeletarAnexo,
  vincularAnexo: mockVincularAnexo,
  desvincularAnexo: mockDesvincularAnexo,
  buscarOcrResultado: mockBuscarOcrResultado,
}));

jest.unstable_mockModule('../../middleware/jwtAuth.js', () => ({
  jwtAuthMiddleware: (req, _res, next) => {
    req.user = { sub: 'user-uuid-001', role: 'user' };
    next();
  },
}));

jest.unstable_mockModule('../../middleware/requireAtivo.js', () => ({
  requireAtivo: (_req, _res, next) => next(),
}));

// Mock upload middleware to bypass multer and inject req.uploadedFile
jest.unstable_mockModule('../../middleware/upload.js', () => ({
  uploadMiddleware: (req, _res, next) => {
    req.uploadedFile = {
      buffer: Buffer.from('fake'),
      originalname: 'boleto.pdf',
      mimetype: 'application/pdf',
      size: 4,
    };
    next();
  },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

let anexosRouter;
let express;

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/anexos.js');
  anexosRouter = mod.default;
});

beforeEach(() => {
  mockUploadAnexo.mockReset();
  mockListarAnexos.mockReset();
  mockBuscarAnexoPorId.mockReset();
  mockDeletarAnexo.mockReset();
  mockVincularAnexo.mockReset();
  mockDesvincularAnexo.mockReset();
  mockBuscarOcrResultado.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(anexosRouter);
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
  const { default: http } = await import('node:http');
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
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          server.close(() =>
            resolve({ status: res.statusCode, body: rawData ? JSON.parse(rawData) : null }),
          );
        });
      });
      req.on('error', (e) => server.close(() => reject(e)));
      if (data) req.write(data);
      req.end();
    });
  });
}

const ANEXO_BASE = {
  id: 'anexo-uuid-001',
  usuario_id: 'user-uuid-001',
  nome_original: 'boleto.pdf',
  nome_arquivo: 'anexo-uuid-001.pdf',
  mime_type: 'application/pdf',
  tamanho_bytes: 1024,
  url: '/uploads/user-uuid-001/anexo-uuid-001.pdf',
  hash_sha256: 'abc123',
  vinculos: [],
  ocr_resultado: null,
};

// POST /anexos
describe('POST /anexos', () => {
  test('retorna 201 com o anexo criado', async () => {
    mockUploadAnexo.mockResolvedValue(ANEXO_BASE);
    const app = makeApp();
    const res = await request(app, 'POST', '/anexos', null);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('anexo-uuid-001');
  });
});

// GET /anexos
describe('GET /anexos', () => {
  test('retorna 200 com lista paginada', async () => {
    mockListarAnexos.mockResolvedValue({ data: [ANEXO_BASE], total: 1, page: 1, limit: 20 });
    const app = makeApp();
    const res = await request(app, 'GET', '/anexos', null);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });
});

// GET /anexos/:id
describe('GET /anexos/:id', () => {
  test('retorna 200 com o anexo', async () => {
    mockBuscarAnexoPorId.mockResolvedValue(ANEXO_BASE);
    const app = makeApp();
    const res = await request(app, 'GET', '/anexos/anexo-uuid-001', null);
    expect(res.status).toBe(200);
  });

  test('retorna 404 quando não encontrado', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockBuscarAnexoPorId.mockRejectedValue(AppError.notFound('Anexo não encontrado.'));
    const app = makeApp();
    const res = await request(app, 'GET', '/anexos/nao-existe', null);
    expect(res.status).toBe(404);
  });
});

// DELETE /anexos/:id
describe('DELETE /anexos/:id', () => {
  test('retorna 204 ao deletar', async () => {
    mockDeletarAnexo.mockResolvedValue(undefined);
    const app = makeApp();
    const res = await request(app, 'DELETE', '/anexos/anexo-uuid-001', null);
    expect(res.status).toBe(204);
  });
});

// POST /anexos/:id/vinculos
describe('POST /anexos/:id/vinculos', () => {
  test('retorna 201 com vínculo criado', async () => {
    const vinculo = { id: 'vinc-001', anexo_id: 'anexo-uuid-001', entidade_tipo: 'contas_pagar', entidade_id: 'cp-001' };
    mockVincularAnexo.mockResolvedValue(vinculo);
    const app = makeApp();
    const res = await request(app, 'POST', '/anexos/anexo-uuid-001/vinculos', {
      entidade_tipo: 'contas_pagar',
      entidade_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(res.status).toBe(201);
  });

  test('retorna 422 com entidade_tipo inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/anexos/anexo-uuid-001/vinculos', {
      entidade_tipo: 'tipo_invalido',
      entidade_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(res.status).toBe(422);
  });
});

// DELETE /anexos/:id/vinculos
describe('DELETE /anexos/:id/vinculos', () => {
  test('retorna 204 ao desvincular', async () => {
    mockDesvincularAnexo.mockResolvedValue(undefined);
    const app = makeApp();
    const res = await request(app, 'DELETE', '/anexos/anexo-uuid-001/vinculos', {
      entidade_tipo: 'contas_pagar',
      entidade_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(res.status).toBe(204);
  });
});

// GET /anexos/:id/ocr
describe('GET /anexos/:id/ocr', () => {
  test('retorna 200 com resultado OCR', async () => {
    const ocr = { id: 'ocr-001', anexo_id: 'anexo-uuid-001', status: 'PROCESSED', extracted_amount: 100 };
    mockBuscarOcrResultado.mockResolvedValue(ocr);
    const app = makeApp();
    const res = await request(app, 'GET', '/anexos/anexo-uuid-001/ocr', null);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PROCESSED');
  });
});
