import { jest } from '@jest/globals';

const mockCreate = jest.fn();
const mockTransaction = jest.fn();

jest.unstable_mockModule('../../lib/prisma.js', () => ({
  default: {
    $transaction: mockTransaction,
  },
}));

const mockCreateDefaultCategories = jest.fn();
jest.unstable_mockModule('../categoriaService.js', () => ({
  createDefaultCategoriesForUser: mockCreateDefaultCategories,
  categoriasSistema: [],
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

let registerUser;

beforeAll(async () => {
  const mod = await import('../usuarioService.js');
  registerUser = mod.registerUser;
});

beforeEach(() => {
  mockCreate.mockReset();
  mockTransaction.mockReset();
  mockCreateDefaultCategories.mockReset();
});

describe('registerUser', () => {
  test('creates user and default categories inside a transaction', async () => {
    const fakeUsuario = {
      id: 'uuid-123',
      nome: 'João',
      email: 'joao@example.com',
      created_at: new Date(),
    };

    mockCreateDefaultCategories.mockResolvedValue(16);
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        usuario: {
          create: jest.fn().mockResolvedValue(fakeUsuario),
        },
      };
      return fn(tx);
    });

    const result = await registerUser({
      nome: 'João',
      email: 'joao@example.com',
      senha: 'password123',
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateDefaultCategories).toHaveBeenCalledWith(fakeUsuario.id, expect.anything());
    expect(result.id).toBe('uuid-123');
    expect(result.categorias_criadas).toBe(16);
  });

  test('hashes the password before storing', async () => {
    const fakeUsuario = {
      id: 'uuid-456',
      nome: 'Maria',
      email: 'maria@example.com',
      created_at: new Date(),
    };

    mockCreateDefaultCategories.mockResolvedValue(16);

    let capturedData;
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        usuario: {
          create: jest.fn().mockImplementation(({ data }) => {
            capturedData = data;
            return Promise.resolve(fakeUsuario);
          }),
        },
      };
      return fn(tx);
    });

    await registerUser({
      nome: 'Maria',
      email: 'maria@example.com',
      senha: 'mysecretpassword',
    });

    expect(capturedData.senha_hash).toBeDefined();
    expect(capturedData.senha_hash).not.toBe('mysecretpassword');
    expect(capturedData.senha_hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  test('propagates transaction errors', async () => {
    mockTransaction.mockRejectedValue(new Error('DB failure'));

    await expect(
      registerUser({ nome: 'Test', email: 'test@example.com', senha: 'password123' })
    ).rejects.toThrow('DB failure');
  });
});
