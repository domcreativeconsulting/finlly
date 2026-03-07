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
  usuarioVerificacaoEmail: {
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
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../../services/passwordRecoveryService.js', () => ({
  maskEmail: (email) => {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.slice(0, 2)}***@${domain}`;
  },
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    JWT_SECRET: 'test_secret_minimum_32_chars_long_enough',
    EMAIL_VERIFICATION_EXPIRATION: 86400,
    FORGOT_PASSWORD_RATE_LIMIT: 3,
    FORGOT_PASSWORD_RATE_WINDOW: 3600,
    VERIFY_EMAIL_RATE_LIMIT: 3,
    VERIFY_EMAIL_RATE_WINDOW: 3600,
    MAIL_FROM: 'noreply@finlly.com',
    APP_URL: 'http://localhost:5173',
  },
}));

// ---------------------------------------------------------------------------
// Service under test
// ---------------------------------------------------------------------------
let verifyEmail;
let resendVerificationEmail;
let generateEmailVerificationToken;

beforeAll(async () => {
  const mod = await import('../emailVerificationService.js');
  verifyEmail = mod.verifyEmail;
  resendVerificationEmail = mod.resendVerificationEmail;
  generateEmailVerificationToken = mod.generateEmailVerificationToken;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.incr.mockResolvedValue(1);
  mockRedis.expire.mockResolvedValue(1);
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  mockPrisma.usuarioEventoAuth.create.mockResolvedValue({});
});

const JWT_SECRET = 'test_secret_minimum_32_chars_long_enough';

function makeVerificationToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// ---------------------------------------------------------------------------
// generateEmailVerificationToken
// ---------------------------------------------------------------------------
describe('generateEmailVerificationToken', () => {
  test('creates verification record and returns a JWT', async () => {
    mockPrisma.usuarioVerificacaoEmail.create.mockResolvedValue({});

    const token = await generateEmailVerificationToken('user-uuid-1');

    expect(typeof token).toBe('string');
    expect(mockPrisma.usuarioVerificacaoEmail.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.usuarioVerificacaoEmail.create.mock.calls[0][0].data;
    expect(data.usuario_id).toBe('user-uuid-1');
    expect(data.verificado).toBe(false);

    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.tipo).toBe('email_verification');
    expect(decoded.sub).toBe('user-uuid-1');
  });
});

// ---------------------------------------------------------------------------
// verifyEmail
// ---------------------------------------------------------------------------
describe('verifyEmail', () => {
  test('throws 400 on invalid JWT', async () => {
    await expect(verifyEmail('not.a.jwt')).rejects.toMatchObject({ status: 400 });
  });

  test('throws 400 on expired JWT', async () => {
    const token = makeVerificationToken(
      { sub: 'uid', verificationId: 'vid', tipo: 'email_verification' },
      '0s',
    );
    await new Promise((r) => setTimeout(r, 10));
    await expect(verifyEmail(token)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('expirado'),
    });
  });

  test('throws 400 when tipo is wrong', async () => {
    const token = makeVerificationToken({ sub: 'uid', verificationId: 'vid', tipo: 'wrong' });
    await expect(verifyEmail(token)).rejects.toMatchObject({ status: 400 });
  });

  test('throws 404 when user not found', async () => {
    const token = makeVerificationToken({ sub: 'uid', verificationId: 'vid', tipo: 'email_verification' });
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await expect(verifyEmail(token)).rejects.toMatchObject({ status: 404 });
  });

  test('throws 400 when email already verified', async () => {
    const token = makeVerificationToken({ sub: 'uid', verificationId: 'vid', tipo: 'email_verification' });
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      email_verificado: true,
    });

    await expect(verifyEmail(token)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('já verificado'),
    });
  });

  test('throws 400 when verification record not found', async () => {
    const token = makeVerificationToken({ sub: 'uid', verificationId: 'vid', tipo: 'email_verification' });
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      email_verificado: false,
    });
    mockPrisma.usuarioVerificacaoEmail.findUnique.mockResolvedValue(null);

    await expect(verifyEmail(token)).rejects.toMatchObject({ status: 400 });
  });

  test('verifies email successfully and returns usuario_id', async () => {
    const token = makeVerificationToken({ sub: 'uid', verificationId: 'vid', tipo: 'email_verification' });
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      email_verificado: false,
    });
    mockPrisma.usuarioVerificacaoEmail.findUnique.mockResolvedValue({
      id: 'vid',
      usuario_id: 'uid',
      token_hash: tokenHash,
      verificado: false,
      data_expiracao: new Date(Date.now() + 86400000),
    });
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.usuarioVerificacaoEmail.update.mockResolvedValue({});

    const result = await verifyEmail(token);

    expect(result.message).toBe('E-mail verificado com sucesso');
    expect(result.usuario_id).toBe('uid');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('registers audit event on successful verification', async () => {
    const token = makeVerificationToken({ sub: 'uid', verificationId: 'vid', tipo: 'email_verification' });
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      email_verificado: false,
    });
    mockPrisma.usuarioVerificacaoEmail.findUnique.mockResolvedValue({
      id: 'vid',
      usuario_id: 'uid',
      token_hash: tokenHash,
      verificado: false,
      data_expiracao: new Date(Date.now() + 86400000),
    });
    mockPrisma.usuario.update.mockResolvedValue({});
    mockPrisma.usuarioVerificacaoEmail.update.mockResolvedValue({});

    await verifyEmail(token);

    expect(mockPrisma.usuarioEventoAuth.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'email_verificado', sucesso: true }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// resendVerificationEmail
// ---------------------------------------------------------------------------
describe('resendVerificationEmail', () => {
  test('returns generic message when user does not exist', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    const result = await resendVerificationEmail('unknown@example.com');
    expect(result.message).toBe('E-mail de verificação reenviado');
    expect(result.email_masked).toBe('un***@example.com');
    expect(mockPrisma.usuarioVerificacaoEmail.create).not.toHaveBeenCalled();
  });

  test('throws 400 when email already verified', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      email_verificado: true,
    });

    await expect(resendVerificationEmail('joao@example.com')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('já verificado'),
    });
  });

  test('sends verification email and returns masked email', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      email_verificado: false,
    });
    mockPrisma.usuarioVerificacaoEmail.create.mockResolvedValue({});

    const result = await resendVerificationEmail('joao@example.com');

    expect(result.message).toBe('E-mail de verificação reenviado');
    expect(result.email_masked).toBe('jo***@example.com');
    expect(mockPrisma.usuarioVerificacaoEmail.create).toHaveBeenCalledTimes(1);
  });

  test('throws 429 when rate limit exceeded', async () => {
    mockRedis.incr.mockResolvedValue(4); // over limit of 3

    await expect(resendVerificationEmail('joao@example.com')).rejects.toMatchObject({ status: 429 });
  });

  test('registers audit event', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 'uid',
      email: 'joao@example.com',
      email_verificado: false,
    });
    mockPrisma.usuarioVerificacaoEmail.create.mockResolvedValue({});

    await resendVerificationEmail('joao@example.com');

    expect(mockPrisma.usuarioEventoAuth.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'verify_email_reenviado', sucesso: true }),
      }),
    );
  });
});
