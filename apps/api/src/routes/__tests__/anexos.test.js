import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

// Upload middleware mock (mutable so beforeEach can override behavior)
let uploadMiddlewareMock = (req, _res, next) => {
  req.uploadedFile = {
    buffer: Buffer.from('fake-file'),
    originalname: 'test.pdf',
    mimetype: 'application/pdf',
    size: 9,
  };
  next();
};

const mockUploadAnexo = jest.fn();
const mockListarAnexos = jest.fn();
const mockBuscarAnexoPorId = jest.fn();
const mockDeletarAnexo = jest.fn();
const mockVincularAnexo = jest.fn();
const mockDesvincularAnexo = jest.fn();
const mockBuscarOcrResultado = jest.fn();

jest.unstable_mockModule('../../services/anexoService.js', () => ({
  uploadAnexo: mockUploadAnexo,
  listarAnexos: mockListarAnexos,
  buscarAnexoPorId: mockBuscarAnexoPorId,
  deletarAnexo: mockDeletarAnexo,
  vincularAnexo: mockVincularAnexo,
  desvincularAnexo: mockDesvincularAnexo,
  buscarOcrResultado: mockBuscarOcrResultado,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../middleware/jwtAuth.js', () => ({
  jwtAuthMiddleware: (req, _res, next) => {
    req.user = { sub: 'usuario-uuid-001' };
    next();
  },
}));

jest.unstable_mockModule('../../middleware/requireAtivo.js', () => ({
  requireAtivo: (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../middleware/upload.js', () => ({
  // Wrap in a stable function reference so that beforeEach changes to
  // uploadMiddlewareMock are picked up at request time (not route-setup time).
  uploadMiddleware: (req, res, next) => uploadMiddlewareMock(req, res, next),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

let anexosRouter;
let express;

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/anexos.js');
  anexosRouter = mod.default;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset upload middleware to success scenario
  uploadMiddlewareMock = (req, _res, next) => {
    req.uploadedFile = {
      buffer: Buffer.from('fake-file'),
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 9,
    };
    next();
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(anexosRouter);
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
            resolve({
              status: res.statusCode,
              body: rawData ? JSON.parse(rawData) : null,
              headers: res.headers,
            }),
          );
        });
      });
      req.on('error', (e) => server.close(() => reject(e)));
      if (data) req.write(data);
      req.end();
    });
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ANEXO_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const ENTIDADE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const USER_ID = 'usuario-uuid-001';

const MOCK_ANEXO = {
  id: ANEXO_ID,
  usuario_id: USER_ID,
  nome_original: 'boleto.pdf',
  nome_arquivo: `${ANEXO_ID}.pdf`,
  mime_type: 'application/pdf',
  tamanho_bytes: 9,
  url: `/uploads/${USER_ID}/${ANEXO_ID}.pdf`,
  hash_sha256: 'abc123',
  deleted_at: null,
  vinculos: [],
  ocr_resultado: { status: 'UPLOADED' },
};

const MOCK_OCR = {
  id: 'ocr-001',
  anexo_id: ANEXO_ID,
  status: 'PROCESSED',
  extracted_amount: 150.0,
  extracted_date: '2026-03-31',
  extracted_description: 'Boleto processado',
  extracted_type: 'saida',
  confidence_score: 0.9,
};

// ---------------------------------------------------------------------------
// POST /anexos
// ---------------------------------------------------------------------------

describe('POST /anexos', () => {
  test('201 — upload com sucesso', async () => {
    mockUploadAnexo.mockResolvedValue(MOCK_ANEXO);

    const app = makeApp();
    const res = await request(app, 'POST', '/anexos');

    expect(res.status).toBe(201);
    expect(res.body).toEqual(MOCK_ANEXO);
    expect(mockUploadAnexo).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: USER_ID,
        file: expect.objectContaining({ mimetype: 'application/pdf' }),
      }),
    );
  });

  test('400 — sem arquivo enviado', async () => {
    uploadMiddlewareMock = (_req, res, _next) => {
      res.status(400).json({ code: 'FILE_REQUIRED', message: 'Nenhum arquivo enviado.' });
    };

    const app = makeApp();
    const res = await request(app, 'POST', '/anexos');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_REQUIRED');
  });

  test('400 — tipo de arquivo inválido', async () => {
    uploadMiddlewareMock = (_req, res, _next) => {
      res.status(400).json({ code: 'INVALID_MIME_TYPE', message: 'Tipo de arquivo não permitido.' });
    };

    const app = makeApp();
    const res = await request(app, 'POST', '/anexos');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_MIME_TYPE');
  });

  test('500 — erro interno ao salvar', async () => {
    const err = new Error('DB error');
    err.status = 500;
    err.code = 'INTERNAL_SERVER_ERROR';
    mockUploadAnexo.mockRejectedValue(err);

    const app = makeApp();
    const res = await request(app, 'POST', '/anexos');

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /anexos
// ---------------------------------------------------------------------------

describe('GET /anexos', () => {
  test('200 — lista anexos do usuário', async () => {
    const resultado = { data: [MOCK_ANEXO], total: 1, page: 1, limit: 20 };
    mockListarAnexos.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', '/anexos');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resultado);
    expect(mockListarAnexos).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: USER_ID, page: 1, limit: 20 }),
    );
  });

  test('200 — filtra por entidade_tipo', async () => {
    const resultado = { data: [], total: 0, page: 1, limit: 20 };
    mockListarAnexos.mockResolvedValue(resultado);

    const app = makeApp();
    const res = await request(app, 'GET', `/anexos?entidade_tipo=contas_pagar&entidade_id=${ENTIDADE_ID}`);

    expect(res.status).toBe(200);
    expect(mockListarAnexos).toHaveBeenCalledWith(
      expect.objectContaining({ entidadeTipo: 'contas_pagar', entidadeId: ENTIDADE_ID }),
    );
  });

  test('422 — entidade_tipo inválido', async () => {
    const app = makeApp();
    const res = await request(app, 'GET', '/anexos?entidade_tipo=invalido');

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// GET /anexos/:id
// ---------------------------------------------------------------------------

describe('GET /anexos/:id', () => {
  test('200 — retorna o anexo', async () => {
    mockBuscarAnexoPorId.mockResolvedValue(MOCK_ANEXO);

    const app = makeApp();
    const res = await request(app, 'GET', `/anexos/${ANEXO_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(MOCK_ANEXO);
  });

  test('404 — anexo não encontrado', async () => {
    const err = new Error('Anexo não encontrado.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    mockBuscarAnexoPorId.mockRejectedValue(err);

    const app = makeApp();
    const res = await request(app, 'GET', `/anexos/${ANEXO_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// DELETE /anexos/:id
// ---------------------------------------------------------------------------

describe('DELETE /anexos/:id', () => {
  test('204 — soft-delete com sucesso', async () => {
    mockDeletarAnexo.mockResolvedValue({ ...MOCK_ANEXO, deleted_at: new Date().toISOString() });

    const app = makeApp();
    const res = await request(app, 'DELETE', `/anexos/${ANEXO_ID}`);

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  test('404 — anexo não encontrado', async () => {
    const err = new Error('Anexo não encontrado.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    mockDeletarAnexo.mockRejectedValue(err);

    const app = makeApp();
    const res = await request(app, 'DELETE', `/anexos/${ANEXO_ID}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /anexos/:id/vinculos
// ---------------------------------------------------------------------------

describe('POST /anexos/:id/vinculos', () => {
  test('201 — vínculo criado com sucesso', async () => {
    const vinculo = {
      id: 'vinculo-001',
      anexo_id: ANEXO_ID,
      entidade_tipo: 'contas_pagar',
      entidade_id: ENTIDADE_ID,
    };
    mockVincularAnexo.mockResolvedValue(vinculo);

    const app = makeApp();
    const res = await request(app, 'POST', `/anexos/${ANEXO_ID}/vinculos`, {
      entidade_tipo: 'contas_pagar',
      entidade_id: ENTIDADE_ID,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(vinculo);
  });

  test('422 — validação falha sem entidade_tipo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/anexos/${ANEXO_ID}/vinculos`, {
      entidade_id: ENTIDADE_ID,
    });

    expect(res.status).toBe(422);
  });

  test('422 — entidade_id inválido (não UUID)', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/anexos/${ANEXO_ID}/vinculos`, {
      entidade_tipo: 'contas_pagar',
      entidade_id: 'not-a-uuid',
    });

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// DELETE /anexos/:id/vinculos
// ---------------------------------------------------------------------------

describe('DELETE /anexos/:id/vinculos', () => {
  test('204 — desvincula com sucesso', async () => {
    mockDesvincularAnexo.mockResolvedValue(undefined);

    const app = makeApp();
    const res = await request(app, 'DELETE', `/anexos/${ANEXO_ID}/vinculos`, {
      entidade_tipo: 'contas_pagar',
      entidade_id: ENTIDADE_ID,
    });

    expect(res.status).toBe(204);
  });

  test('404 — vínculo não encontrado', async () => {
    const err = new Error('Vínculo não encontrado.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    mockDesvincularAnexo.mockRejectedValue(err);

    const app = makeApp();
    const res = await request(app, 'DELETE', `/anexos/${ANEXO_ID}/vinculos`, {
      entidade_tipo: 'contas_pagar',
      entidade_id: ENTIDADE_ID,
    });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /anexos/:id/ocr
// ---------------------------------------------------------------------------

describe('GET /anexos/:id/ocr', () => {
  test('200 — retorna resultado OCR', async () => {
    mockBuscarOcrResultado.mockResolvedValue(MOCK_OCR);

    const app = makeApp();
    const res = await request(app, 'GET', `/anexos/${ANEXO_ID}/ocr`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(MOCK_OCR);
  });

  test('404 — resultado OCR não encontrado', async () => {
    const err = new Error('Resultado OCR não encontrado.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    mockBuscarOcrResultado.mockRejectedValue(err);

    const app = makeApp();
    const res = await request(app, 'GET', `/anexos/${ANEXO_ID}/ocr`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// POST /anexos/:id/ocr/confirmar
// ---------------------------------------------------------------------------

describe('POST /anexos/:id/ocr/confirmar', () => {
  test('200 — retorna sugestão confirmada com confirmed: true', async () => {
    mockBuscarOcrResultado.mockResolvedValue(MOCK_OCR);

    const app = makeApp();
    const res = await request(app, 'POST', `/anexos/${ANEXO_ID}/ocr/confirmar`, {
      extracted_amount: 250.0,
      extracted_description: 'Aluguel março',
    });

    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(true);
    expect(res.body.extracted_amount).toBe(250.0);
    expect(res.body.extracted_description).toBe('Aluguel março');
    // Campos não fornecidos mantêm o valor original do OCR
    expect(res.body.extracted_type).toBe(MOCK_OCR.extracted_type);
  });

  test('200 — sem campos ajustados retorna OCR original com confirmed: true', async () => {
    mockBuscarOcrResultado.mockResolvedValue(MOCK_OCR);

    const app = makeApp();
    const res = await request(app, 'POST', `/anexos/${ANEXO_ID}/ocr/confirmar`, {});

    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(true);
    expect(res.body.extracted_amount).toBe(MOCK_OCR.extracted_amount);
  });

  test('404 — OCR não encontrado para o anexo', async () => {
    const err = new Error('Resultado OCR não encontrado.');
    err.status = 404;
    err.code = 'NOT_FOUND';
    mockBuscarOcrResultado.mockRejectedValue(err);

    const app = makeApp();
    const res = await request(app, 'POST', `/anexos/${ANEXO_ID}/ocr/confirmar`, {});

    expect(res.status).toBe(404);
  });

  test('422 — extracted_description muito longo', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', `/anexos/${ANEXO_ID}/ocr/confirmar`, {
      extracted_description: 'x'.repeat(501),
    });

    expect(res.status).toBe(422);
  });
});
