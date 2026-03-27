import { jest } from '@jest/globals';

const mockMetaFindMany = jest.fn();
const mockMetaCount = jest.fn();
const mockMetaFindFirst = jest.fn();
const mockMetaCreate = jest.fn();
const mockMetaUpdate = jest.fn();
const mockMetaMovimentoCreate = jest.fn();
const mockMetaMovimentoFindFirst = jest.fn();
const mockMetaMovimentoUpdate = jest.fn();

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: {
    meta: {
      findMany: mockMetaFindMany,
      count: mockMetaCount,
      findFirst: mockMetaFindFirst,
      create: mockMetaCreate,
      update: mockMetaUpdate,
    },
    metaMovimento: {
      create: mockMetaMovimentoCreate,
      findFirst: mockMetaMovimentoFindFirst,
      update: mockMetaMovimentoUpdate,
    },
  },
}));

let listMetas;
let getMeta;
let createMeta;
let updateMeta;
let deleteMeta;
let createMovimento;
let deleteMovimento;
let getProgresso;

const USER_ID = 'usuario-uuid-001';
const META_ID = '33333333-3333-4333-8333-333333333333';
const MOV_ID = '44444444-4444-4444-8444-444444444444';

const metaRow = {
  id: META_ID,
  usuario_id: USER_ID,
  nome: 'Viagem Europa',
  tipo: 'economia',
  valor_alvo: '10000.00',
  data_inicio: new Date('2026-01-01T00:00:00.000Z'),
  data_fim: null,
  status: 'ativa',
  icone: null,
  cor: null,
  observacoes: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  deleted_at: null,
  movimentos: [],
};

const movimentoRow = {
  id: MOV_ID,
  meta_id: META_ID,
  usuario_id: USER_ID,
  valor: '2500.00',
  data: new Date('2026-01-15T00:00:00.000Z'),
  descricao: null,
  movimentacao_id: null,
  created_at: new Date('2026-01-15T00:00:00.000Z'),
  updated_at: new Date('2026-01-15T00:00:00.000Z'),
  deleted_at: null,
};

beforeAll(async () => {
  const mod = await import('../metaService.js');
  listMetas = mod.listMetas;
  getMeta = mod.getMeta;
  createMeta = mod.createMeta;
  updateMeta = mod.updateMeta;
  deleteMeta = mod.deleteMeta;
  createMovimento = mod.createMovimento;
  deleteMovimento = mod.deleteMovimento;
  getProgresso = mod.getProgresso;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// listMetas
// ============================================================

describe('listMetas', () => {
  test('retorna paginação correta (items, total, totalPages)', async () => {
    mockMetaFindMany.mockResolvedValue([{ ...metaRow, movimentos: [] }]);
    mockMetaCount.mockResolvedValue(1);

    const result = await listMetas(USER_ID, { page: 1, limit: 20 });

    expect(result).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(result.items).toHaveLength(1);
  });

  test('passa filtros status e tipo ao Prisma', async () => {
    mockMetaFindMany.mockResolvedValue([]);
    mockMetaCount.mockResolvedValue(0);

    await listMetas(USER_ID, { status: 'ativa', tipo: 'economia', page: 1, limit: 20 });

    expect(mockMetaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ativa', tipo: 'economia' }),
      }),
    );
  });

  test('calcula valorAtual como soma dos movimentos não deletados', async () => {
    const movAtivo = { ...movimentoRow, valor: '1000.00', deleted_at: null };
    const movDeletado = { ...movimentoRow, id: 'outro', valor: '500.00', deleted_at: new Date() };
    mockMetaFindMany.mockResolvedValue([{ ...metaRow, movimentos: [movAtivo, movDeletado] }]);
    mockMetaCount.mockResolvedValue(1);

    const result = await listMetas(USER_ID, { page: 1, limit: 20 });

    expect(result.items[0].valorAtual).toBe(1000);
  });

  test('calcula percentualConcluido corretamente (arredondado, max 100)', async () => {
    const mov1 = { ...movimentoRow, valor: '15000.00', deleted_at: null };
    mockMetaFindMany.mockResolvedValue([{ ...metaRow, valor_alvo: '10000.00', movimentos: [mov1] }]);
    mockMetaCount.mockResolvedValue(1);

    const result = await listMetas(USER_ID, { page: 1, limit: 20 });

    expect(result.items[0].percentualConcluido).toBe(100);
  });
});

// ============================================================
// getMeta
// ============================================================

describe('getMeta', () => {
  test('retorna meta com movimentos formatados', async () => {
    mockMetaFindFirst.mockResolvedValue({ ...metaRow, movimentos: [movimentoRow] });

    const result = await getMeta(USER_ID, META_ID);

    expect(result.item).toMatchObject({ id: META_ID, nome: 'Viagem Europa' });
    expect(result.item.movimentos).toHaveLength(1);
    expect(result.item.movimentos[0]).toMatchObject({ id: MOV_ID, valor: 2500 });
  });

  test('lança AppError.notFound quando meta não existe', async () => {
    mockMetaFindFirst.mockResolvedValue(null);

    await expect(getMeta(USER_ID, 'nao-existe')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('lança AppError.notFound quando meta não pertence ao usuário', async () => {
    mockMetaFindFirst.mockResolvedValue(null);

    await expect(getMeta('outro-usuario', META_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(mockMetaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ usuario_id: 'outro-usuario' }) }),
    );
  });
});

// ============================================================
// createMeta
// ============================================================

describe('createMeta', () => {
  test('cria meta com usuario_id = userId (nunca do input)', async () => {
    mockMetaCreate.mockResolvedValue(metaRow);

    await createMeta(USER_ID, {
      nome: 'Viagem Europa',
      tipo: 'economia',
      valor_alvo: 10000,
      data_inicio: '2026-01-01',
    });

    expect(mockMetaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usuario_id: USER_ID }),
      }),
    );
  });

  test('retorna meta formatada', async () => {
    mockMetaCreate.mockResolvedValue(metaRow);

    const result = await createMeta(USER_ID, {
      nome: 'Viagem Europa',
      tipo: 'economia',
      valor_alvo: 10000,
      data_inicio: '2026-01-01',
    });

    expect(result.item).toMatchObject({ id: META_ID, nome: 'Viagem Europa', valorAlvo: 10000 });
  });
});

// ============================================================
// updateMeta
// ============================================================

describe('updateMeta', () => {
  test('atualiza campos corretamente', async () => {
    mockMetaFindFirst.mockResolvedValue(metaRow);
    mockMetaUpdate.mockResolvedValue({ ...metaRow, nome: 'Viagem EUA', movimentos: [] });

    const result = await updateMeta(USER_ID, META_ID, { nome: 'Viagem EUA' });

    expect(mockMetaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nome: 'Viagem EUA' }),
      }),
    );
    expect(result.item.nome).toBe('Viagem EUA');
  });

  test('lança AppError.notFound quando meta não existe', async () => {
    mockMetaFindFirst.mockResolvedValue(null);

    await expect(updateMeta(USER_ID, 'nao-existe', { nome: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

// ============================================================
// deleteMeta
// ============================================================

describe('deleteMeta', () => {
  test('aplica soft-delete (deleted_at não null)', async () => {
    mockMetaFindFirst.mockResolvedValue(metaRow);
    mockMetaUpdate.mockResolvedValue({ ...metaRow, deleted_at: new Date() });

    await deleteMeta(USER_ID, META_ID);

    expect(mockMetaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      }),
    );
  });

  test('lança AppError.notFound quando meta não existe', async () => {
    mockMetaFindFirst.mockResolvedValue(null);

    await expect(deleteMeta(USER_ID, 'nao-existe')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('retorna { deleted: true }', async () => {
    mockMetaFindFirst.mockResolvedValue(metaRow);
    mockMetaUpdate.mockResolvedValue({ ...metaRow, deleted_at: new Date() });

    const result = await deleteMeta(USER_ID, META_ID);

    expect(result).toEqual({ deleted: true });
  });
});

// ============================================================
// createMovimento
// ============================================================

describe('createMovimento', () => {
  test('persiste com meta_id e usuario_id', async () => {
    mockMetaFindFirst.mockResolvedValue(metaRow);
    mockMetaMovimentoCreate.mockResolvedValue(movimentoRow);

    await createMovimento(USER_ID, META_ID, { valor: 500, data: '2026-02-01' });

    expect(mockMetaMovimentoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ meta_id: META_ID, usuario_id: USER_ID }),
      }),
    );
  });

  test('lança AppError.notFound quando meta não existe ou não pertence ao usuário', async () => {
    mockMetaFindFirst.mockResolvedValue(null);

    await expect(createMovimento(USER_ID, 'nao-existe', { valor: 500, data: '2026-02-01' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('retorna movimento formatado', async () => {
    mockMetaFindFirst.mockResolvedValue(metaRow);
    mockMetaMovimentoCreate.mockResolvedValue(movimentoRow);

    const result = await createMovimento(USER_ID, META_ID, { valor: 500, data: '2026-02-01' });

    expect(result.item).toMatchObject({ id: MOV_ID, metaId: META_ID, valor: 2500 });
  });
});

// ============================================================
// deleteMovimento
// ============================================================

describe('deleteMovimento', () => {
  test('aplica soft-delete no movimento', async () => {
    mockMetaFindFirst.mockResolvedValue(metaRow);
    mockMetaMovimentoFindFirst.mockResolvedValue(movimentoRow);
    mockMetaMovimentoUpdate.mockResolvedValue({ ...movimentoRow, deleted_at: new Date() });

    await deleteMovimento(USER_ID, META_ID, MOV_ID);

    expect(mockMetaMovimentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleted_at: expect.any(Date) }),
      }),
    );
  });

  test('lança AppError.notFound quando meta não existe', async () => {
    mockMetaFindFirst.mockResolvedValue(null);

    await expect(deleteMovimento(USER_ID, 'nao-existe', MOV_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('lança AppError.notFound quando movimento não existe', async () => {
    mockMetaFindFirst.mockResolvedValue(metaRow);
    mockMetaMovimentoFindFirst.mockResolvedValue(null);

    await expect(deleteMovimento(USER_ID, META_ID, 'nao-existe')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('retorna { deleted: true }', async () => {
    mockMetaFindFirst.mockResolvedValue(metaRow);
    mockMetaMovimentoFindFirst.mockResolvedValue(movimentoRow);
    mockMetaMovimentoUpdate.mockResolvedValue({ ...movimentoRow, deleted_at: new Date() });

    const result = await deleteMovimento(USER_ID, META_ID, MOV_ID);

    expect(result).toEqual({ deleted: true });
  });
});

// ============================================================
// getProgresso
// ============================================================

describe('getProgresso', () => {
  test('calcula percentualConcluido = 0 quando sem movimentos', async () => {
    mockMetaFindFirst.mockResolvedValue({ ...metaRow, movimentos: [] });

    const result = await getProgresso(USER_ID, META_ID);

    expect(result.item.percentualConcluido).toBe(0);
    expect(result.item.valorAtual).toBe(0);
  });

  test('calcula percentualConcluido corretamente (max 100)', async () => {
    const mov = { ...movimentoRow, valor: '12000.00', deleted_at: null };
    mockMetaFindFirst.mockResolvedValue({ ...metaRow, valor_alvo: '10000.00', movimentos: [mov] });

    const result = await getProgresso(USER_ID, META_ID);

    expect(result.item.percentualConcluido).toBe(100);
  });

  test('calcula valorRestante = 0 quando meta já ultrapassada', async () => {
    const mov = { ...movimentoRow, valor: '15000.00', deleted_at: null };
    mockMetaFindFirst.mockResolvedValue({ ...metaRow, valor_alvo: '10000.00', movimentos: [mov] });

    const result = await getProgresso(USER_ID, META_ID);

    expect(result.item.valorRestante).toBe(0);
  });

  test('retorna shape completo', async () => {
    const mov = { ...movimentoRow, valor: '2500.00', deleted_at: null };
    mockMetaFindFirst.mockResolvedValue({ ...metaRow, movimentos: [mov] });

    const result = await getProgresso(USER_ID, META_ID);

    expect(result.item).toMatchObject({
      id: META_ID,
      nome: 'Viagem Europa',
      tipo: 'economia',
      valorAlvo: 10000,
      valorAtual: 2500,
      percentualConcluido: 25,
      valorRestante: 7500,
      status: 'ativa',
      totalMovimentos: 1,
      dataInicio: expect.any(String),
      dataFim: null,
    });
  });
});
