import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock: database singleton (Prisma client)
// ---------------------------------------------------------------------------
const mockPrisma = {
  categoria: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

// ---------------------------------------------------------------------------
// Import service under test (must happen after mocks are registered)
// ---------------------------------------------------------------------------
let createDefaultCategories;
let updateCategoria;
let deleteCategoria;

beforeAll(async () => {
  const mod = await import('../categoriaService.js');
  createDefaultCategories = mod.createDefaultCategories;
  updateCategoria = mod.updateCategoria;
  deleteCategoria = mod.deleteCategoria;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper fixtures
// ---------------------------------------------------------------------------
const USER_ID = 'user-uuid-001';
const CAT_ID = 'cat-uuid-001';

const systemTemplates = [
  { nome: 'Salário', tipo: 'entrada', icone: null, cor: null },
  { nome: 'Freelance', tipo: 'entrada', icone: null, cor: null },
  { nome: 'Alimentação', tipo: 'saida', icone: null, cor: null },
];

// ---------------------------------------------------------------------------
// createDefaultCategories
// ---------------------------------------------------------------------------
describe('createDefaultCategories', () => {
  test('copies system templates to the user and returns count', async () => {
    mockPrisma.categoria.findMany.mockResolvedValue(systemTemplates);
    mockPrisma.categoria.createMany.mockResolvedValue({ count: 3 });

    const count = await createDefaultCategories(USER_ID);

    expect(mockPrisma.categoria.findMany).toHaveBeenCalledWith({
      where: { is_sistema: true, usuario_id: null },
      select: { nome: true, tipo: true, icone: true, cor: true },
    });

    expect(mockPrisma.categoria.createMany).toHaveBeenCalledWith({
      data: systemTemplates.map((t) => ({
        nome: t.nome,
        tipo: t.tipo,
        icone: undefined,
        cor: undefined,
        usuario_id: USER_ID,
        is_sistema: false,
      })),
      skipDuplicates: true,
    });

    expect(count).toBe(3);
  });

  test('returns 0 when no system templates exist', async () => {
    mockPrisma.categoria.findMany.mockResolvedValue([]);

    const count = await createDefaultCategories(USER_ID);

    expect(count).toBe(0);
    expect(mockPrisma.categoria.createMany).not.toHaveBeenCalled();
  });

  test('uses provided transaction client instead of singleton', async () => {
    const mockTx = {
      categoria: {
        findMany: jest.fn().mockResolvedValue(systemTemplates),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };

    const count = await createDefaultCategories(USER_ID, mockTx);

    expect(mockTx.categoria.findMany).toHaveBeenCalled();
    expect(mockTx.categoria.createMany).toHaveBeenCalled();
    expect(mockPrisma.categoria.findMany).not.toHaveBeenCalled();
    expect(count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// updateCategoria
// ---------------------------------------------------------------------------
describe('updateCategoria', () => {
  test('updates a user-owned category successfully', async () => {
    const existing = { id: CAT_ID, usuario_id: USER_ID, is_sistema: false, deleted_at: null };
    const updated = { ...existing, nome: 'Novo Nome' };
    mockPrisma.categoria.findFirst.mockResolvedValue(existing);
    mockPrisma.categoria.update.mockResolvedValue(updated);

    const result = await updateCategoria(CAT_ID, USER_ID, { nome: 'Novo Nome' });

    expect(result.nome).toBe('Novo Nome');
    expect(mockPrisma.categoria.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CAT_ID } })
    );
  });

  test('throws NOT_FOUND when category does not exist', async () => {
    mockPrisma.categoria.findFirst.mockResolvedValue(null);

    await expect(updateCategoria(CAT_ID, USER_ID, {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('throws FORBIDDEN when category is a system category', async () => {
    const sysCategory = { id: CAT_ID, usuario_id: null, is_sistema: true, deleted_at: null };
    mockPrisma.categoria.findFirst.mockResolvedValue(sysCategory);

    await expect(updateCategoria(CAT_ID, USER_ID, { nome: 'Hack' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  test('throws FORBIDDEN when category belongs to a different user', async () => {
    const otherUserCategory = { id: CAT_ID, usuario_id: 'other-user', is_sistema: false, deleted_at: null };
    mockPrisma.categoria.findFirst.mockResolvedValue(otherUserCategory);

    await expect(updateCategoria(CAT_ID, USER_ID, { nome: 'Hack' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});

// ---------------------------------------------------------------------------
// deleteCategoria
// ---------------------------------------------------------------------------
describe('deleteCategoria', () => {
  test('soft-deletes a user-owned category successfully', async () => {
    const existing = { id: CAT_ID, usuario_id: USER_ID, is_sistema: false, deleted_at: null };
    mockPrisma.categoria.findFirst.mockResolvedValue(existing);
    mockPrisma.categoria.update.mockResolvedValue({ ...existing, deleted_at: new Date() });

    const result = await deleteCategoria(CAT_ID, USER_ID);

    expect(result.deleted_at).toBeTruthy();
    expect(mockPrisma.categoria.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CAT_ID } })
    );
  });

  test('throws NOT_FOUND when category does not exist', async () => {
    mockPrisma.categoria.findFirst.mockResolvedValue(null);

    await expect(deleteCategoria(CAT_ID, USER_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  test('throws FORBIDDEN when category is a system category', async () => {
    const sysCategory = { id: CAT_ID, usuario_id: null, is_sistema: true, deleted_at: null };
    mockPrisma.categoria.findFirst.mockResolvedValue(sysCategory);

    await expect(deleteCategoria(CAT_ID, USER_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  test('throws FORBIDDEN when category belongs to a different user', async () => {
    const otherUserCategory = { id: CAT_ID, usuario_id: 'other-user', is_sistema: false, deleted_at: null };
    mockPrisma.categoria.findFirst.mockResolvedValue(otherUserCategory);

    await expect(deleteCategoria(CAT_ID, USER_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });
});
