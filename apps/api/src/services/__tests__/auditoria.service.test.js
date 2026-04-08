import { jest } from '@jest/globals';

const mockCreate = jest.fn();
const mockLogError = jest.fn();

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: {
    auditoriaEvento: {
      create: mockCreate,
    },
  },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: {
    error: mockLogError,
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

let registrarEvento;

beforeAll(async () => {
  const mod = await import('../auditoria.service.js');
  registrarEvento = mod.registrarEvento;
});

beforeEach(() => {
  mockCreate.mockReset();
  mockLogError.mockReset();
});

describe('registrarEvento', () => {
  test('creates an auditoria event with all provided fields', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-1' });

    await registrarEvento({
      usuarioId: 'user-uuid',
      tipo: 'login',
      detalhes: { email: 'user@test.com' },
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      sucesso: true,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        usuario_id: 'user-uuid',
        tipo: 'login',
        detalhes: { email: 'user@test.com' },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        sucesso: true,
      },
    });
  });

  test('defaults sucesso to true when not provided', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-2' });

    await registrarEvento({ tipo: 'registro' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sucesso: true }),
      })
    );
  });

  test('uses null for usuarioId when not provided', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-3' });

    await registrarEvento({ tipo: 'login' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usuario_id: null }),
      })
    );
  });

  test('truncates ip_address to 45 characters', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-4' });
    const longIp = 'a'.repeat(100);

    await registrarEvento({ tipo: 'login', ip: longIp });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.ip_address).toHaveLength(45);
  });

  test('truncates user_agent to 512 characters', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-5' });
    const longAgent = 'b'.repeat(600);

    await registrarEvento({ tipo: 'login', userAgent: longAgent });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.user_agent).toHaveLength(512);
  });

  test('does not throw when prisma.create fails (fail-safe)', async () => {
    mockCreate.mockRejectedValue(new Error('DB connection lost'));

    await expect(registrarEvento({ tipo: 'login' })).resolves.toBeUndefined();
  });

  test('logs error when prisma.create fails', async () => {
    mockCreate.mockRejectedValue(new Error('DB down'));

    await registrarEvento({ tipo: 'login' });

    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ msg: expect.stringContaining('auditoria') })
    );
  });

  test('handles null detalhes', async () => {
    mockCreate.mockResolvedValue({ id: 'uuid-6' });

    await registrarEvento({ tipo: 'conta_criada' });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.detalhes).toBeNull();
  });
});
