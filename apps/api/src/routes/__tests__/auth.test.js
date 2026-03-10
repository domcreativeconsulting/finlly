import { jest } from '@jest/globals';
import { Buffer } from 'buffer';

// Mock all service and utility dependencies
const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockRefresh = jest.fn();
const mockLogout = jest.fn();
const mockGetMe = jest.fn();
const mockForgotPassword = jest.fn();
const mockResetPassword = jest.fn();
const mockVerifyEmail = jest.fn();
const mockResendVerificationEmail = jest.fn();

// Mock express-rate-limit to be a pass-through in tests
jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: () => (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../services/authService.js', () => ({
  register: mockRegister,
  login: mockLogin,
  refresh: mockRefresh,
  logout: mockLogout,
  getMe: mockGetMe,
  parseExpiresInSeconds: (val) => {
    const match = String(val || '').match(/^(\d+)([smhd]?)$/);
    if (!match) return 30 * 24 * 60 * 60;
    const n = parseInt(match[1], 10);
    const unit = match[2] || 's';
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (multipliers[unit] || 1);
  },
}));

jest.unstable_mockModule('../../services/passwordRecoveryService.js', () => ({
  forgotPassword: mockForgotPassword,
  resetPassword: mockResetPassword,
  maskEmail: (email) => {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  },
}));

jest.unstable_mockModule('../../services/emailVerificationService.js', () => ({
  verifyEmail: mockVerifyEmail,
  resendVerificationEmail: mockResendVerificationEmail,
}));

jest.unstable_mockModule('../../logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    NODE_ENV: 'test',
    API_PORT: 3001,
    JWT_SECRET: 'test_secret_minimum_32_chars_long_enough',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'test_refresh_secret_minimum_32_chars_long',
    JWT_REFRESH_EXPIRES_IN: '30d',
    PASSWORD_RESET_EXPIRATION: 900,
    EMAIL_VERIFICATION_EXPIRATION: 86400,
    FORGOT_PASSWORD_RATE_LIMIT: 3,
    FORGOT_PASSWORD_RATE_WINDOW: 3600,
    VERIFY_EMAIL_RATE_LIMIT: 3,
    VERIFY_EMAIL_RATE_WINDOW: 3600,
    APP_URL: 'http://localhost:5173',
  },
}));

// Mock jwtAuthMiddleware to inject a fake user
jest.unstable_mockModule('../../middleware/jwtAuth.js', () => ({
  jwtAuthMiddleware: (req, _res, next) => {
    req.user = { sub: 'user-uuid-123', sessionId: 'session-uuid-456' };
    next();
  },
}));

let authRouter;
let express;

beforeAll(async () => {
  const expressMod = await import('express');
  express = expressMod.default;
  const mod = await import('../../routes/auth.js');
  authRouter = mod.default;
});

beforeEach(() => {
  mockRegister.mockReset();
  mockLogin.mockReset();
  mockRefresh.mockReset();
  mockLogout.mockReset();
  mockGetMe.mockReset();
  mockForgotPassword.mockReset();
  mockResetPassword.mockReset();
  mockVerifyEmail.mockReset();
  mockResendVerificationEmail.mockReset();
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message,
      details: err.details,
    });
  });
  return app;
}

async function request(app, method, path, body, headers = {}) {
  const { default: http } = await import('http');
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const data = body ? JSON.stringify(body) : undefined;
      const options = {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          server.close(() =>
            resolve({ status: res.statusCode, body: JSON.parse(rawData), headers: res.headers }),
          );
        });
      });
      req.on('error', (e) => server.close(() => reject(e)));
      if (data) req.write(data);
      req.end();
    });
  });
}

// ============================================================
// POST /auth/register
// ============================================================
describe('POST /auth/register', () => {
  const validBody = {
    nome: 'João Silva',
    email: 'joao@example.com',
    senha: 'SenhaSegura123!',
  };

  test('returns 201 with user data on valid input', async () => {
    mockRegister.mockResolvedValue({
      usuario_id: 'uuid-123',
      email: 'joao@example.com',
      nome: 'João Silva',
      message: 'Cadastro realizado com sucesso. Verifique seu e-mail.',
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/register', validBody);

    expect(res.status).toBe(201);
    expect(res.body.usuario_id).toBe('uuid-123');
    expect(res.body.message).toContain('Cadastro realizado com sucesso');
  });

  test('returns 422 when nome is too short', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/register', { ...validBody, nome: 'Jo' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 422 when email is invalid', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/register', {
      ...validBody,
      email: 'not-an-email',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 422 when senha is missing uppercase', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/register', {
      ...validBody,
      senha: 'senhasegura123!',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 422 when senha is missing special char', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/register', {
      ...validBody,
      senha: 'SenhaSegura123',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when email already exists', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockRegister.mockRejectedValue(AppError.badRequest('Email já existe'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/register', validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Email já existe');
  });
});

// ============================================================
// POST /auth/login
// ============================================================
describe('POST /auth/login', () => {
  const validBody = {
    email: 'joao@example.com',
    senha: 'SenhaSegura123!',
  };

  test('returns 200 with tokens on valid credentials', async () => {
    mockLogin.mockResolvedValue({
      accessToken: 'access.token.here',
      refreshToken: 'refresh.token.here',
      usuario: { id: 'uuid-123', nome: 'João Silva', email: 'joao@example.com', role: 'user', status: 'ativo' },
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/login', validBody);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('access.token.here');
    expect(res.body.refreshToken).toBe('refresh.token.here');
    expect(res.body.usuario.id).toBe('uuid-123');
  });

  test('returns 422 when email is missing', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/login', { senha: 'SenhaSegura123!' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 401 when credentials are wrong', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockLogin.mockRejectedValue(AppError.unauthorized('Credenciais inválidas'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/login', validBody);
    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Credenciais inválidas');
  });

  test('returns 429 when rate limit exceeded', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockLogin.mockRejectedValue(AppError.tooManyRequests('Muitas tentativas.'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/login', validBody);
    expect(res.status).toBe(429);
  });

  test('returns 423 when account is locked', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockLogin.mockRejectedValue(AppError.locked('Conta bloqueada'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/login', validBody);
    expect(res.status).toBe(423);
  });
});

// ============================================================
// POST /auth/refresh
// ============================================================
describe('POST /auth/refresh', () => {
  test('returns 200 with new accessToken', async () => {
    mockRefresh.mockResolvedValue({ accessToken: 'new.access.token' });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/refresh', {
      refreshToken: 'valid.refresh.token',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new.access.token');
  });

  test('returns 400 when refreshToken is absent', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/refresh', {});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Refresh token ausente');
  });

  test('returns 401 when refreshToken is invalid', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockRefresh.mockRejectedValue(AppError.unauthorized('Refresh token inválido ou expirado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/refresh', {
      refreshToken: 'invalid.token',
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================
// POST /auth/logout
// ============================================================
describe('POST /auth/logout', () => {
  test('returns 200 with sessoes_revogadas', async () => {
    mockLogout.mockResolvedValue({ message: 'Logout realizado com sucesso', sessoes_revogadas: 1 });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/logout', {});
    expect(res.status).toBe(200);
    expect(res.body.sessoes_revogadas).toBe(1);
    expect(res.body.message).toContain('Logout realizado com sucesso');
  });

  test('returns 200 when logging out all sessions', async () => {
    mockLogout.mockResolvedValue({ message: 'Logout realizado com sucesso', sessoes_revogadas: 3 });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/logout', { todas: true });
    expect(res.status).toBe(200);
    expect(res.body.sessoes_revogadas).toBe(3);
  });

  test('returns 422 when sessao_id is not a valid uuid', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/logout', { sessao_id: 'not-a-uuid' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ============================================================
// GET /auth/me
// ============================================================
describe('GET /auth/me', () => {
  test('returns 200 with user data', async () => {
    mockGetMe.mockResolvedValue({
      id: 'user-uuid-123',
      nome: 'João Silva',
      email: 'joao@example.com',
      role: 'user',
      status: 'ativo',
    });

    const app = makeApp();
    const res = await request(app, 'GET', '/auth/me', null);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('user-uuid-123');
    expect(res.body.nome).toBe('João Silva');
  });

  test('returns 404 when user not found', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockGetMe.mockRejectedValue(AppError.notFound('Usuário não encontrado'));

    const app = makeApp();
    const res = await request(app, 'GET', '/auth/me', null);
    expect(res.status).toBe(404);
  });
});

// ============================================================
// POST /auth/forgot-password
// ============================================================
describe('POST /auth/forgot-password', () => {
  const validBody = { email: 'joao@example.com' };

  test('returns 200 with generic message on valid email', async () => {
    mockForgotPassword.mockResolvedValue({
      message: 'Se esse e-mail estiver registrado, você receberá um link de recuperação em breve',
      email_masked: 'jo***@example.com',
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/forgot-password', validBody);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Se esse e-mail estiver registrado');
    expect(res.body.email_masked).toBe('jo***@example.com');
  });

  test('returns 422 when email is invalid', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/forgot-password', { email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 422 when email is missing', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/forgot-password', {});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 429 when rate limit exceeded', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockForgotPassword.mockRejectedValue(AppError.tooManyRequests('Muitas tentativas.'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/forgot-password', validBody);
    expect(res.status).toBe(429);
  });
});

// ============================================================
// POST /auth/reset-password
// ============================================================
describe('POST /auth/reset-password', () => {
  const validBody = {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
    nova_senha: 'NovaSegura123!',
  };

  test('returns 200 on successful password reset', async () => {
    mockResetPassword.mockResolvedValue({
      message: 'Senha redefinida com sucesso',
      usuario_id: 'uuid-123',
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/reset-password', validBody);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Senha redefinida com sucesso');
    expect(res.body.usuario_id).toBe('uuid-123');
  });

  test('returns 422 when token is missing', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/reset-password', { nova_senha: 'NovaSegura123!' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 422 when nova_senha is too weak', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/reset-password', {
      token: 'some.jwt.token',
      nova_senha: 'weak',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 422 when nova_senha lacks special char', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/reset-password', {
      token: 'some.jwt.token',
      nova_senha: 'NovaSegura123',
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when token is expired', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockResetPassword.mockRejectedValue(AppError.badRequest('Token expirado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/reset-password', validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Token expirado');
  });

  test('returns 400 when token already used', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockResetPassword.mockRejectedValue(AppError.badRequest('Token já foi utilizado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/reset-password', validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Token já foi utilizado');
  });

  test('returns 403 when user is blocked', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockResetPassword.mockRejectedValue(AppError.forbidden('Usuário bloqueado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/reset-password', validBody);
    expect(res.status).toBe(403);
  });
});

// ============================================================
// POST /auth/verify-email
// ============================================================
describe('POST /auth/verify-email', () => {
  const validBody = { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test' };

  test('returns 200 on successful email verification', async () => {
    mockVerifyEmail.mockResolvedValue({
      message: 'E-mail verificado com sucesso',
      usuario_id: 'uuid-123',
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/verify-email', validBody);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('E-mail verificado com sucesso');
    expect(res.body.usuario_id).toBe('uuid-123');
  });

  test('returns 422 when token is missing', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/verify-email', {});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when token is invalid', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockVerifyEmail.mockRejectedValue(AppError.badRequest('Token ausente ou inválido'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/verify-email', validBody);
    expect(res.status).toBe(400);
  });

  test('returns 400 when email already verified', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockVerifyEmail.mockRejectedValue(AppError.badRequest('E-mail já verificado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/verify-email', validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('E-mail já verificado');
  });

  test('returns 404 when user not found', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockVerifyEmail.mockRejectedValue(AppError.notFound('Usuário não encontrado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/verify-email', validBody);
    expect(res.status).toBe(404);
  });
});

// ============================================================
// POST /auth/resend-verification-email
// ============================================================
describe('POST /auth/resend-verification-email', () => {
  const validBody = { email: 'joao@example.com' };

  test('returns 200 with masked email', async () => {
    mockResendVerificationEmail.mockResolvedValue({
      message: 'E-mail de verificação reenviado',
      email_masked: 'jo***@example.com',
    });

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/resend-verification-email', validBody);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('E-mail de verificação reenviado');
    expect(res.body.email_masked).toBe('jo***@example.com');
  });

  test('returns 422 when email is invalid', async () => {
    const app = makeApp();
    const res = await request(app, 'POST', '/auth/resend-verification-email', { email: 'bad-email' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when email already verified', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockResendVerificationEmail.mockRejectedValue(AppError.badRequest('E-mail já verificado'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/resend-verification-email', validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('E-mail já verificado');
  });

  test('returns 429 when rate limit exceeded', async () => {
    const { AppError } = await import('../../errors/AppError.js');
    mockResendVerificationEmail.mockRejectedValue(AppError.tooManyRequests('Muitas tentativas.'));

    const app = makeApp();
    const res = await request(app, 'POST', '/auth/resend-verification-email', validBody);
    expect(res.status).toBe(429);
  });
});
