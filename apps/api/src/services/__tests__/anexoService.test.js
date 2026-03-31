import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock: Prisma client
// ---------------------------------------------------------------------------
const mockAnexoCreate = jest.fn();
const mockAnexoFindMany = jest.fn();
const mockAnexoCount = jest.fn();
const mockAnexoFindFirst = jest.fn();
const mockAnexoUpdate = jest.fn();
const mockOcrCreate = jest.fn();
const mockOcrFindUnique = jest.fn();
const mockOcrUpdate = jest.fn();
const mockVinculoCreate = jest.fn();
const mockVinculoFindFirst = jest.fn();
const mockVinculoDelete = jest.fn();
const mockJobCreate = jest.fn();

const mockPrisma = {
  anexo: {
    create: mockAnexoCreate,
    findMany: mockAnexoFindMany,
    count: mockAnexoCount,
    findFirst: mockAnexoFindFirst,
    update: mockAnexoUpdate,
  },
  anexoOcrResultado: {
    create: mockOcrCreate,
    findUnique: mockOcrFindUnique,
    update: mockOcrUpdate,
  },
  anexoVinculo: {
    create: mockVinculoCreate,
    findFirst: mockVinculoFindFirst,
    delete: mockVinculoDelete,
  },
  job: {
    create: mockJobCreate,
  },
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    UPLOADS_DIR: '/tmp/test-uploads',
    MAX_UPLOAD_SIZE_MB: 10,
  },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock node:fs/promises to avoid actual file writes
jest.unstable_mockModule('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let uploadAnexo;
let listarAnexos;
let buscarAnexoPorId;
let deletarAnexo;
let vincularAnexo;
let desvincularAnexo;
let buscarOcrResultado;

beforeAll(async () => {
  const mod = await import('../anexoService.js');
  uploadAnexo = mod.uploadAnexo;
  listarAnexos = mod.listarAnexos;
  buscarAnexoPorId = mod.buscarAnexoPorId;
  deletarAnexo = mod.deletarAnexo;
  vincularAnexo = mod.vincularAnexo;
  desvincularAnexo = mod.desvincularAnexo;
  buscarOcrResultado = mod.buscarOcrResultado;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const USER_ID = 'user-uuid-001';
const ANEXO_ID = 'anexo-uuid-001';
const ENTIDADE_ID = 'entidade-uuid-001';

const MOCK_BUFFER = Buffer.from('fake file content');
const MOCK_FILE = {
  buffer: MOCK_BUFFER,
  originalname: 'boleto.pdf',
  mimetype: 'application/pdf',
  size: MOCK_BUFFER.length,
};

const MOCK_ANEXO = {
  id: ANEXO_ID,
  usuario_id: USER_ID,
  nome_original: 'boleto.pdf',
  nome_arquivo: `${ANEXO_ID}.pdf`,
  mime_type: 'application/pdf',
  tamanho_bytes: BigInt(MOCK_BUFFER.length),
  url: `/tmp/test-uploads/${USER_ID}/${ANEXO_ID}.pdf`,
  hash_sha256: 'abc123',
  deleted_at: null,
  vinculos: [],
  ocr_resultado: null,
};

// ---------------------------------------------------------------------------
// uploadAnexo
// ---------------------------------------------------------------------------
describe('uploadAnexo', () => {
  test('cria anexo com sucesso e enfileira job OCR', async () => {
    mockAnexoCreate.mockResolvedValue(MOCK_ANEXO);
    mockOcrCreate.mockResolvedValue({});
    mockJobCreate.mockResolvedValue({});

    const result = await uploadAnexo({ usuarioId: USER_ID, file: MOCK_FILE });

    expect(mockAnexoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuario_id: USER_ID,
          nome_original: 'boleto.pdf',
          mime_type: 'application/pdf',
        }),
      }),
    );
    expect(mockOcrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'UPLOADED' }) }),
    );
    expect(mockJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'ocr_processar', status: 'pendente' }) }),
    );
    expect(result).toEqual(MOCK_ANEXO);
  });

  test('rejeita mime-type inválido', async () => {
    const invalidFile = { ...MOCK_FILE, mimetype: 'text/plain' };

    await expect(uploadAnexo({ usuarioId: USER_ID, file: invalidFile })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
    expect(mockAnexoCreate).not.toHaveBeenCalled();
  });

  test('rejeita arquivo muito grande', async () => {
    const bigFile = { ...MOCK_FILE, size: 11 * 1024 * 1024 }; // 11MB

    await expect(uploadAnexo({ usuarioId: USER_ID, file: bigFile })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
    expect(mockAnexoCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listarAnexos
// ---------------------------------------------------------------------------
describe('listarAnexos', () => {
  test('lista anexos do usuário com paginação', async () => {
    mockAnexoFindMany.mockResolvedValue([MOCK_ANEXO]);
    mockAnexoCount.mockResolvedValue(1);

    const result = await listarAnexos({ usuarioId: USER_ID });

    expect(mockAnexoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ usuario_id: USER_ID, deleted_at: null }) }),
    );
    expect(result).toEqual({ data: [MOCK_ANEXO], total: 1, page: 1, limit: 20 });
  });

  test('filtra por entidade quando fornecido', async () => {
    mockAnexoFindMany.mockResolvedValue([]);
    mockAnexoCount.mockResolvedValue(0);

    await listarAnexos({ usuarioId: USER_ID, entidadeTipo: 'contas_pagar', entidadeId: ENTIDADE_ID });

    expect(mockAnexoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vinculos: { some: { entidade_tipo: 'contas_pagar', entidade_id: ENTIDADE_ID } },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// buscarAnexoPorId
// ---------------------------------------------------------------------------
describe('buscarAnexoPorId', () => {
  test('retorna anexo quando pertence ao usuário', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);

    const result = await buscarAnexoPorId({ usuarioId: USER_ID, anexoId: ANEXO_ID });
    expect(result).toEqual(MOCK_ANEXO);
  });

  test('lança NOT_FOUND quando não encontrado', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(buscarAnexoPorId({ usuarioId: USER_ID, anexoId: ANEXO_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('lança NOT_FOUND quando pertence a outro usuário (ownership)', async () => {
    mockAnexoFindFirst.mockResolvedValue(null); // Prisma retorna null porque filtra por usuario_id

    await expect(buscarAnexoPorId({ usuarioId: 'outro-user', anexoId: ANEXO_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

// ---------------------------------------------------------------------------
// deletarAnexo
// ---------------------------------------------------------------------------
describe('deletarAnexo', () => {
  test('realiza soft-delete com sucesso', async () => {
    const now = new Date();
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockAnexoUpdate.mockResolvedValue({ ...MOCK_ANEXO, deleted_at: now });

    const result = await deletarAnexo({ usuarioId: USER_ID, anexoId: ANEXO_ID });

    expect(mockAnexoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ANEXO_ID }, data: expect.objectContaining({ deleted_at: expect.any(Date) }) }),
    );
    expect(result.deleted_at).toBeTruthy();
  });

  test('lança NOT_FOUND quando anexo não existe', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(deletarAnexo({ usuarioId: USER_ID, anexoId: ANEXO_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('lança NOT_FOUND ao tentar deletar anexo de outro usuário', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(deletarAnexo({ usuarioId: 'outro-user', anexoId: ANEXO_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

// ---------------------------------------------------------------------------
// vincularAnexo
// ---------------------------------------------------------------------------
describe('vincularAnexo', () => {
  test('cria vínculo com entidade válida', async () => {
    const vinculo = { id: 'vinculo-001', anexo_id: ANEXO_ID, entidade_tipo: 'contas_pagar', entidade_id: ENTIDADE_ID };
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockVinculoCreate.mockResolvedValue(vinculo);

    const result = await vincularAnexo({ usuarioId: USER_ID, anexoId: ANEXO_ID, entidadeTipo: 'contas_pagar', entidadeId: ENTIDADE_ID });

    expect(mockVinculoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { anexo_id: ANEXO_ID, entidade_tipo: 'contas_pagar', entidade_id: ENTIDADE_ID } }),
    );
    expect(result).toEqual(vinculo);
  });

  test('lança BAD_REQUEST para entidade_tipo inválido', async () => {
    await expect(
      vincularAnexo({ usuarioId: USER_ID, anexoId: ANEXO_ID, entidadeTipo: 'tipo_invalido', entidadeId: ENTIDADE_ID }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', status: 400 });

    expect(mockVinculoCreate).not.toHaveBeenCalled();
  });

  test('lança NOT_FOUND quando o anexo não pertence ao usuário', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(
      vincularAnexo({ usuarioId: 'outro-user', anexoId: ANEXO_ID, entidadeTipo: 'metas', entidadeId: ENTIDADE_ID }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

// ---------------------------------------------------------------------------
// desvincularAnexo
// ---------------------------------------------------------------------------
describe('desvincularAnexo', () => {
  test('remove vínculo com sucesso', async () => {
    const vinculo = { id: 'vinculo-001', anexo_id: ANEXO_ID, entidade_tipo: 'contas_pagar', entidade_id: ENTIDADE_ID };
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockVinculoFindFirst.mockResolvedValue(vinculo);
    mockVinculoDelete.mockResolvedValue(vinculo);

    await expect(
      desvincularAnexo({ usuarioId: USER_ID, anexoId: ANEXO_ID, entidadeTipo: 'contas_pagar', entidadeId: ENTIDADE_ID }),
    ).resolves.toBeUndefined();

    expect(mockVinculoDelete).toHaveBeenCalledWith({ where: { id: 'vinculo-001' } });
  });

  test('lança NOT_FOUND quando vínculo não existe', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockVinculoFindFirst.mockResolvedValue(null);

    await expect(
      desvincularAnexo({ usuarioId: USER_ID, anexoId: ANEXO_ID, entidadeTipo: 'contas_pagar', entidadeId: ENTIDADE_ID }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  test('lança NOT_FOUND quando o anexo não pertence ao usuário', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(
      desvincularAnexo({ usuarioId: 'outro-user', anexoId: ANEXO_ID, entidadeTipo: 'metas', entidadeId: ENTIDADE_ID }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});

// ---------------------------------------------------------------------------
// buscarOcrResultado
// ---------------------------------------------------------------------------
describe('buscarOcrResultado', () => {
  test('retorna resultado OCR quando existente', async () => {
    const ocr = { id: 'ocr-001', anexo_id: ANEXO_ID, status: 'PROCESSED', extracted_amount: 100 };
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockOcrFindUnique.mockResolvedValue(ocr);

    const result = await buscarOcrResultado({ usuarioId: USER_ID, anexoId: ANEXO_ID });
    expect(result).toEqual(ocr);
  });

  test('lança NOT_FOUND quando resultado OCR não existe', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockOcrFindUnique.mockResolvedValue(null);

    await expect(buscarOcrResultado({ usuarioId: USER_ID, anexoId: ANEXO_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('lança NOT_FOUND se anexo não pertence ao usuário', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(buscarOcrResultado({ usuarioId: 'outro-user', anexoId: ANEXO_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});
