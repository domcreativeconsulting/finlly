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
    STORAGE_DRIVER: 'local',
  },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Mock: storage provider
// ---------------------------------------------------------------------------
const mockStorageUpload = jest.fn();
const mockStorageDelete = jest.fn();
const mockStorageGetDownloadReference = jest.fn();

const mockStorageProvider = {
  upload: mockStorageUpload,
  delete: mockStorageDelete,
  getDownloadReference: mockStorageGetDownloadReference,
};

jest.unstable_mockModule('../../storage/index.js', () => ({
  getStorageProvider: jest.fn(() => mockStorageProvider),
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
let obterDownloadReference;

beforeAll(async () => {
  const mod = await import('../anexoService.js');
  uploadAnexo = mod.uploadAnexo;
  listarAnexos = mod.listarAnexos;
  buscarAnexoPorId = mod.buscarAnexoPorId;
  deletarAnexo = mod.deletarAnexo;
  vincularAnexo = mod.vincularAnexo;
  desvincularAnexo = mod.desvincularAnexo;
  buscarOcrResultado = mod.buscarOcrResultado;
  obterDownloadReference = mod.obterDownloadReference;
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

const MOCK_STORAGE_PATH = `/tmp/test-uploads/${USER_ID}/${ANEXO_ID}.pdf`;

const MOCK_ANEXO = {
  id: ANEXO_ID,
  usuario_id: USER_ID,
  nome_original: 'boleto.pdf',
  nome_arquivo: `${ANEXO_ID}.pdf`,
  mime_type: 'application/pdf',
  tamanho_bytes: BigInt(MOCK_BUFFER.length),
  storage_driver: 'local',
  storage_path: MOCK_STORAGE_PATH,
  url: MOCK_STORAGE_PATH,
  hash_sha256: 'abc123',
  deleted_at: null,
  vinculos: [],
  ocr_resultado: null,
};

// ---------------------------------------------------------------------------
// uploadAnexo
// ---------------------------------------------------------------------------
describe('uploadAnexo', () => {
  beforeEach(() => {
    mockStorageUpload.mockResolvedValue({ storagePath: MOCK_STORAGE_PATH, url: MOCK_STORAGE_PATH });
    mockStorageDelete.mockResolvedValue(undefined);
  });

  test('cria anexo com sucesso e enfileira job OCR', async () => {
    mockAnexoCreate.mockResolvedValue(MOCK_ANEXO);
    mockOcrCreate.mockResolvedValue({});
    mockJobCreate.mockResolvedValue({});

    const result = await uploadAnexo({ usuarioId: USER_ID, file: MOCK_FILE });

    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, ext: 'pdf', buffer: MOCK_BUFFER, mimetype: 'application/pdf' }),
    );
    expect(mockAnexoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuario_id: USER_ID,
          nome_original: 'boleto.pdf',
          mime_type: 'application/pdf',
          storage_driver: 'local',
          storage_path: MOCK_STORAGE_PATH,
          url: MOCK_STORAGE_PATH,
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
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  test('rejeita arquivo muito grande', async () => {
    const bigFile = { ...MOCK_FILE, size: 11 * 1024 * 1024 }; // 11MB

    await expect(uploadAnexo({ usuarioId: USER_ID, file: bigFile })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
    expect(mockAnexoCreate).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  test('remove arquivo do storage se persistência falhar (rollback)', async () => {
    const dbError = new Error('DB constraint violation');
    mockAnexoCreate.mockRejectedValue(dbError);

    await expect(uploadAnexo({ usuarioId: USER_ID, file: MOCK_FILE })).rejects.toThrow(dbError);

    expect(mockStorageUpload).toHaveBeenCalled();
    expect(mockStorageDelete).toHaveBeenCalledWith({ storagePath: MOCK_STORAGE_PATH });
  });

  test('chama storageProvider.delete quando prisma.anexo.create lança erro', async () => {
    const dbError = new Error('unique constraint');
    mockAnexoCreate.mockRejectedValue(dbError);

    await expect(uploadAnexo({ usuarioId: USER_ID, file: MOCK_FILE })).rejects.toThrow(dbError);
    expect(mockStorageDelete).toHaveBeenCalledTimes(1);
    expect(mockStorageDelete).toHaveBeenCalledWith({ storagePath: MOCK_STORAGE_PATH });
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

// ---------------------------------------------------------------------------
// obterDownloadReference
// ---------------------------------------------------------------------------
describe('obterDownloadReference', () => {
  test('retorna url e fileName para anexo do usuário', async () => {
    mockAnexoFindFirst.mockResolvedValue(MOCK_ANEXO);
    mockStorageGetDownloadReference.mockResolvedValue('https://presigned.url/file.pdf');

    const result = await obterDownloadReference({ usuarioId: USER_ID, anexoId: ANEXO_ID });

    expect(mockStorageGetDownloadReference).toHaveBeenCalledWith(
      expect.objectContaining({ storagePath: MOCK_ANEXO.storage_path }),
    );
    expect(result).toEqual({ url: 'https://presigned.url/file.pdf', fileName: MOCK_ANEXO.nome_original });
  });

  test('lança NOT_FOUND quando anexo não pertence ao usuário', async () => {
    mockAnexoFindFirst.mockResolvedValue(null);

    await expect(obterDownloadReference({ usuarioId: 'outro-user', anexoId: ANEXO_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(mockStorageGetDownloadReference).not.toHaveBeenCalled();
  });
});
