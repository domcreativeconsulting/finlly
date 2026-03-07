import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  usuarioResetSenha: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  usuarioEventoAuth: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

jest.unstable_mockModule('../../utils/database.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  getRedisClient: jest.fn().mockResolvedValue(mockRedis),
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    JWT_SECRET: 'test_secret_minimum_32_chars_long_enough',
    JWT_EXPIRES_IN: '15m',
    PASSWORD_RESET_EXPIRATION: 900,
    FORGOT_PASSWORD_RATE_LIMIT: 3,
    FORGOT_PASSWORD_RATE_WINDOW: 3600,
    MAIL_FROM: 'noreply@finlly.com',
    APP_URL: 'http://localhost:5173',
  },
}));

// ---------------------------------------------------------------------------
// Service under test
// ---------------------------------------------------------------------------
let forgotPassword;
let resetPassword;
let maskEmail;

beforeAll(async () => {
  const mod = await import('../passwordRecoveryService.js');
  forgotPassword = mod.forgotPassword;
  resetPassword = mod.resetPassword;
  maskEmail = mod.maskEmail;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.incr.mockResolvedValue(1);
  mockRedis.expire.mockResolvedValue(1);
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  mockPrisma.usuarioEventoAuth.create.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// maskEmail
// ---------------------------------------------------------------------------
describe('maskEmail', () => {
  test('masks local part showing only first 2 chars', () => {
    expect(maskEmail('joao@example.com')).toBe('jo***@example.com');
  });

  test('handles short local part', () => {
    expect(maskEmail('ab@example.com')).toBe('ab***@example.com');
  });

  test('returns input if no @', () => {
    expect(maskEmail('noemail')).toBe('noemail');
  });
});

// ---------------------------------------------------------------------------
// forgotPassword
// ---------------------------------------------------------------------------
describe('forgotPassword', () => {
  const GENERIC_MESSAGE = 'Se esse e-mail estiver registrado, você receberá um link de recuperação em breve';

  test('returns generic message when user does not exist', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    const result = await forgotPassword('unknown@example.com');
    expect(result.message).toBe(GENERIC_MESSAGE);
    expect(result.email_masked).toBe('un***@example.com');
    expect(mockPrisma.usuarioResetSenha.create).not.toHaveBeenCalled();
  });

  test('returns generic message when user status is not ativo', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'user-uuid-1',
      email: 'joao@example.com',
      status: 'inativo',
    });

    const result = await forgotPassword('joao@example.com');
    expect(result.message).toBe(GENERIC_MESSAGE);
    expect(mockPrisma.usuarioResetSenha.create).not.toHaveBeenCalled();
  });

  test('creates reset record and returns generic message for active user', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'user-uuid-1',
      email: 'joao@example.com',
      status: 'ativo',
    });
    mockPrisma.usuarioResetSenha.create.mockResolvedValue({ id: 'reset-uuid-1' });

    const result = await forgotPassword('joao@example.com', { ip: '127.0.0.1' });

    expect(result.message).toBe(GENERIC_MESSAGE);
    expect(result.email_masked).toBe('jo***@example.com');
    expect(mockPrisma.usuarioResetSenha.create).toHaveBeenCalledTimes(1);
    const createCall = mockPrisma.usuarioResetSenha.create.mock.calls[0][0].data;
    expect(createCall.usuario_id).toBe('user-uuid-1');
    expect(createCall.utilizado).toBe(false);
    expect(typeof createCall.token_hash).toBe('string');
  });

  test('throws 429 when rate limit exceeded', async () => {
    mockRedis.incr.mockResolvedValue(4); // over limit of 3

    await expect(forgotPassword('joao@example.com')).rejects.toMatchObject({
      status: 429,
    });
  });

  test('registers audit event for active user', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'user-uuid-1',
      email: 'joao@example.com',
      status: 'ativo',
    });
    mockPrisma.usuarioResetSenha.create.mockResolvedValue({ id: 'reset-uuid-1' });

    await forgotPassword('joao@example.com');

    expect(mockPrisma.usuarioEventoAuth.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'reset_senha_solicitado', sucesso: true }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// resetPassword
// ---------------------------------------------------------------------------
describe('resetPassword', () => {
  const JWT_SECRET = 'test_secret_minimum_32_chars_long_enough';

  function makeToken(payload, expiresIn = '15m') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  }

  test('throws 400 on invalid JWT', async () => {
    await expect(resetPassword({ token: 'not.a.jwt', nova_senha: 'Pass1234!' })).rejects.toMatchObject({
      status: 400,
    });
  });

  test('throws 400 on expired JWT', async () => {
    const token = makeToken({ sub: 'uid', resetId: 'rid', tipo: 'password_reset' }, '0s');
    // Wait a tick to ensure expiry
    await new Promise((r) => setTimeout(r, 10));
    await expect(resetPassword({ token, nova_senha: 'Pass1234!' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('expirado'),
    });
  });

  test('throws 400 when tipo is wrong', async () => {
    const token = makeToken({ sub: 'uid', resetId: 'rid', tipo: 'wrong_type' });
    await expect(resetPassword({ token, nova_senha: 'Pass1234!' })).rejects.toMatchObject({ status: 400 });
  });

  test('throws 404 when reset record not found', async () => {
    const token = makeToken({ sub: 'uid', resetId: 'rid', tipo: 'password_reset' });
    mockPrisma.usuarioResetSenha.findUnique.mockResolvedValue(null);

    await expect(resetPassword({ token, nova_senha: 'Pass1234!' })).rejects.toMatchObject({ status: 404 });
  });

  test('throws 400 when token already used', async () => {
    const token = makeToken({ sub: 'uid', resetId: 'rid', tipo: 'password_reset' });
    mockPrisma.usuarioResetSenha.findUnique.mockResolvedValue({
      id: 'rid',
      usuario_id: 'uid',
      token_hash: 'any-hash-value',
      utilizado: true,
      data_expiracao: new Date(Date.now() + 60000),
    });

    await expect(resetPassword({ token, nova_senha: 'Pass1234!' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('utilizado'),
    });
  });

  test('throws 404 when user not found', async () => {
    const token = makeToken({ sub: 'uid', resetId: 'rid', tipo: 'password_reset' });
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    mockPrisma.usuarioResetSenha.findUnique.mockResolvedValue({
      id: 'rid',
      usuario_id: 'uid',
      token_hash: tokenHash,
      utilizado: false,
      data_expiracao: new Date(Date.now() + 60000),
    });
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await expect(resetPassword({ token, nova_senha: 'Pass1234!' })).rejects.toMatchObject({ status: 404 });
  });

  test('throws 403 when user is blocked', async () => {
    const token = makeToken({ sub: 'uid', resetId: 'rid', tipo: 'password_reset' });
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    mockPrisma.usuarioResetSenha.findUnique.mockResolvedValue({
      id: 'rid',
      usuario_id: 'uid',
      token_hash: tokenHash,
      utilizado: false,
      data_expiracao: new Date(Date.now() + 60000),
    });
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      status: 'bloqueado',
    });

    await expect(resetPassword({ token, nova_senha: 'Pass1234!' })).rejects.toMatchObject({ status: 403 });
  });

  test('resets password successfully and returns usuario_id', async () => {
    const token = makeToken({ sub: 'uid', resetId: 'rid', tipo: 'password_reset' });
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    mockPrisma.usuarioResetSenha.findUnique.mockResolvedValue({
      id: 'rid',
      usuario_id: 'uid',
      token_hash: tokenHash,
      utilizado: false,
      data_expiracao: new Date(Date.now() + 60000),
    });
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      status: 'ativo',
    });
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.usuarioResetSenha.update.mockResolvedValue({});

    const result = await resetPassword({ token, nova_senha: 'Pass1234!' });

    expect(result.message).toBe('Senha redefinida com sucesso');
    expect(result.usuario_id).toBe('uid');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('registers audit event on successful reset', async () => {
    const token = makeToken({ sub: 'uid', resetId: 'rid', tipo: 'password_reset' });
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    mockPrisma.usuarioResetSenha.findUnique.mockResolvedValue({
      id: 'rid',
      usuario_id: 'uid',
      token_hash: tokenHash,
      utilizado: false,
      data_expiracao: new Date(Date.now() + 60000),
    });
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      status: 'ativo',
    });
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.usuarioResetSenha.update.mockResolvedValue({});

    await resetPassword({ token, nova_senha: 'Pass1234!' });

    expect(mockPrisma.usuarioEventoAuth.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'reset_senha_concluido', sucesso: true }),
      }),
    );
  });
});
