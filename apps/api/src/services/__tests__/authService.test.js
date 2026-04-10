import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  usuarioSessao: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  usuarioEventoAuth: {
    create: jest.fn(),
  },
  categoria: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRegistrarEvento = jest.fn();

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_ROUNDS: 4,
    NODE_ENV: 'development',
  },
}));

jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

jest.unstable_mockModule('../auditoria.service.js', () => ({
  registrarEvento: mockRegistrarEvento,
}));

// ---------------------------------------------------------------------------
// Service under test
// ---------------------------------------------------------------------------
let login;
let logout;
let refresh;
let register;

const JWT_REFRESH_SECRET = 'test-refresh-secret';

// Pre-compute a bcrypt hash once so login tests are fast.
let SENHA_HASH;

beforeAll(async () => {
  SENHA_HASH = await bcrypt.hash('Senha@123', 4);

  const mod = await import('../authService.js');
  login = mod.login;
  logout = mod.logout;
  refresh = mod.refresh;
  register = mod.register;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRegistrarEvento.mockResolvedValue(undefined);

  // Default $transaction: execute the callback synchronously with mockPrisma as tx
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));

  // Default sub-mocks used by multiple functions
  mockPrisma.usuario.update.mockResolvedValue({});
  mockPrisma.usuarioSessao.create.mockResolvedValue({});
  mockPrisma.usuarioEventoAuth.create.mockResolvedValue({});
  mockPrisma.categoria.findMany.mockResolvedValue([]);
  mockPrisma.categoria.createMany.mockResolvedValue({ count: 0 });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USUARIO_ID = 'user-uuid-001';

const buildUsuario = (overrides = {}) => ({
  id: USUARIO_ID,
  email: 'teste@finlly.com',
  nome: 'Teste',
  senha_hash: SENHA_HASH,
  status: 'ativo',
  role: 'user',
  email_verificado: false,
  bloqueado_ate: null,
  tentativas_login: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe('login', () => {
  test('retorna accessToken, refreshToken e usuario com credenciais corretas', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuario());

    const result = await login({ email: 'teste@finlly.com', senha: 'Senha@123' });

    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      usuario: {
        id: USUARIO_ID,
        email: 'teste@finlly.com',
        nome: 'Teste',
        role: 'user',
        status: 'ativo',
      },
    });
  });

  test('lança AppError 401 com senha errada', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuario());
    mockPrisma.usuario.update.mockResolvedValue({});

    await expect(
      login({ email: 'teste@finlly.com', senha: 'SenhaErrada' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test('lança AppError 401 com email inexistente', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      login({ email: 'naoexiste@finlly.com', senha: 'Senha@123' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test('lança AppError 403 com usuário de status bloqueado', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(
      buildUsuario({ status: 'bloqueado', bloqueado_ate: null }),
    );

    await expect(
      login({ email: 'teste@finlly.com', senha: 'Senha@123' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('lança AppError 403 com usuário de status inativo', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(
      buildUsuario({ status: 'inativo', bloqueado_ate: null }),
    );

    await expect(
      login({ email: 'teste@finlly.com', senha: 'Senha@123' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('lança AppError 423 com usuário temporariamente bloqueado por tentativas', async () => {
    const futureDate = new Date(Date.now() + 30 * 60 * 1000);
    mockPrisma.usuario.findUnique.mockResolvedValue(
      buildUsuario({ bloqueado_ate: futureDate }),
    );

    await expect(
      login({ email: 'teste@finlly.com', senha: 'Senha@123' }),
    ).rejects.toMatchObject({ status: 423 });
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe('logout', () => {
  test('revoga apenas a sessão atual quando todas: false e sessionId válido', async () => {
    const SESSION_ID = 'session-uuid-001';
    mockPrisma.usuarioSessao.findFirst.mockResolvedValue({ id: SESSION_ID, usuario_id: USUARIO_ID });
    mockPrisma.usuarioSessao.update.mockResolvedValue({});

    const result = await logout(USUARIO_ID, { todas: false, sessionId: SESSION_ID });

    expect(result).toMatchObject({ message: expect.any(String), sessoes_revogadas: 1 });
    expect(mockPrisma.usuarioSessao.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SESSION_ID } }),
    );
  });

  test('revoga todas as sessões quando todas: true', async () => {
    mockPrisma.usuarioSessao.updateMany.mockResolvedValue({ count: 3 });

    const result = await logout(USUARIO_ID, { todas: true });

    expect(result).toMatchObject({ sessoes_revogadas: 3 });
    expect(mockPrisma.usuarioSessao.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuario_id: USUARIO_ID, data_revogacao: null } }),
    );
  });

  test('lança BAD_REQUEST 400 quando todas: false e sem sessionId', async () => {
    await expect(
      logout(USUARIO_ID, { todas: false }),
    ).rejects.toMatchObject({ status: 400, message: 'Sessão não identificada' });
  });
});

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------

describe('refresh', () => {
  test('retorna novo accessToken com refreshToken válido', async () => {
    const validRefreshToken = jwt.sign(
      { sub: USUARIO_ID, sessionId: 'session-uuid-001' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' },
    );

    mockPrisma.usuarioSessao.findUnique.mockResolvedValue({
      id: 'session-uuid-001',
      usuario_id: USUARIO_ID,
      data_revogacao: null,
      data_expiracao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usuario: { id: USUARIO_ID, email: 'teste@finlly.com', role: 'user', status: 'ativo' },
    });

    const result = await refresh(validRefreshToken);

    expect(result).toMatchObject({ accessToken: expect.any(String) });
  });

  test('lança AppError 401 com sessão revogada', async () => {
    const validRefreshToken = jwt.sign(
      { sub: USUARIO_ID, sessionId: 'session-uuid-001' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' },
    );

    mockPrisma.usuarioSessao.findUnique.mockResolvedValue({
      id: 'session-uuid-001',
      usuario_id: USUARIO_ID,
      data_revogacao: new Date(),
      data_expiracao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usuario: { id: USUARIO_ID, email: 'teste@finlly.com', role: 'user', status: 'ativo' },
    });

    await expect(refresh(validRefreshToken)).rejects.toMatchObject({
      status: 401,
      message: 'Sessão revogada',
    });
  });

  test('lança AppError 401 com refreshToken inválido', async () => {
    await expect(refresh('token-invalido')).rejects.toMatchObject({ status: 401 });
  });

  test('lança AppError 401 com refreshToken assinado com secret errado', async () => {
    const badToken = jwt.sign({ sub: USUARIO_ID, sessionId: 'session-id' }, 'wrong-secret');

    await expect(refresh(badToken)).rejects.toMatchObject({ status: 401 });
  });
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

describe('register', () => {
  test('retorna usuario_id, email, nome e message com dados válidos', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);
    mockPrisma.usuario.create.mockResolvedValue({
      id: 'new-user-uuid',
      nome: 'Novo Usuário',
      email: 'novo@finlly.com',
    });

    const result = await register({ nome: 'Novo Usuário', email: 'novo@finlly.com', senha: 'Senha@123' });

    expect(result).toMatchObject({
      usuario_id: 'new-user-uuid',
      email: 'novo@finlly.com',
      nome: 'Novo Usuário',
      message: expect.any(String),
    });
  });

  test('lança AppError 400 com email já existente', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuario());

    await expect(
      register({ nome: 'Outro', email: 'teste@finlly.com', senha: 'Senha@123' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
