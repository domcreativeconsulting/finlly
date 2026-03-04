import { jest } from '@jest/globals';

jest.unstable_mockModule('../../lib/prisma.js', () => ({
  default: {},
}));

let createDefaultCategoriesForUser;
let categoriasSistema;

beforeAll(async () => {
  const mod = await import('../categoriaService.js');
  createDefaultCategoriesForUser = mod.createDefaultCategoriesForUser;
  categoriasSistema = mod.categoriasSistema;
});

function makePrismaClient(existingCategories = []) {
  return {
    categoria: {
      findMany: jest.fn().mockResolvedValue(existingCategories),
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('categoriasSistema', () => {
  test('has 16 default categories', () => {
    expect(categoriasSistema).toHaveLength(16);
  });

  test('has 6 income categories', () => {
    const entradas = categoriasSistema.filter((c) => c.tipo === 'entrada');
    expect(entradas).toHaveLength(6);
  });

  test('has 10 expense categories', () => {
    const saidas = categoriasSistema.filter((c) => c.tipo === 'saida');
    expect(saidas).toHaveLength(10);
  });
});

describe('createDefaultCategoriesForUser', () => {
  test('creates all 16 categories for a new user', async () => {
    const usuarioId = 'user-uuid-123';
    const client = makePrismaClient([]);

    const count = await createDefaultCategoriesForUser(usuarioId, client);

    expect(count).toBe(16);
    expect(client.categoria.create).toHaveBeenCalledTimes(16);
    expect(client.categoria.findMany).toHaveBeenCalledWith({
      where: { usuario_id: usuarioId, is_sistema: true },
      select: { nome: true, tipo: true },
    });
  });

  test('is idempotent — skips already existing categories', async () => {
    const usuarioId = 'user-uuid-123';
    const existing = [
      { nome: 'Salário', tipo: 'entrada' },
      { nome: 'Alimentação', tipo: 'saida' },
    ];
    const client = makePrismaClient(existing);

    const count = await createDefaultCategoriesForUser(usuarioId, client);

    expect(count).toBe(14);
    expect(client.categoria.create).toHaveBeenCalledTimes(14);
  });

  test('returns 0 when all categories already exist', async () => {
    const usuarioId = 'user-uuid-123';
    const client = makePrismaClient(
      categoriasSistema.map((c) => ({ nome: c.nome, tipo: c.tipo }))
    );

    const count = await createDefaultCategoriesForUser(usuarioId, client);

    expect(count).toBe(0);
    expect(client.categoria.create).not.toHaveBeenCalled();
  });

  test('sets is_sistema=true and usuario_id on each created category', async () => {
    const usuarioId = 'user-uuid-abc';
    const client = makePrismaClient([]);

    await createDefaultCategoriesForUser(usuarioId, client);

    for (const call of client.categoria.create.mock.calls) {
      expect(call[0].data.is_sistema).toBe(true);
      expect(call[0].data.usuario_id).toBe(usuarioId);
    }
  });
});
