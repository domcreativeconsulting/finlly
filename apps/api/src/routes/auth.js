import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { register, login, refresh, logout, getMe, parseExpiresInSeconds } from '../services/authService.js';
import { forgotPassword, resetPassword } from '../services/passwordRecoveryService.js';
import { verifyEmail, resendVerificationEmail } from '../services/emailVerificationService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { toValidationError } from '../errors/toValidationError.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';
import { getRedisClient } from '../utils/redisClient.js';
import logger from '../logger.js';

const router = Router();

// ============================================================
// Rate Limit Store
// ============================================================

/**
 * Builds an express-rate-limit compatible store backed by Redis when
 * RATE_LIMIT_STORE=redis, or returns undefined (MemoryStore default) otherwise.
 * @param {number} windowMs - Window duration in milliseconds.
 * @returns {object|undefined}
 */
function buildStore(windowMs) {
  if (config.RATE_LIMIT_STORE !== 'redis') return undefined;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return {
    async increment(key) {
      let redis;
      try {
        redis = await getRedisClient();
      } catch {
        return { totalHits: 0, resetTime: new Date(Date.now() + windowMs) };
      }
      const value = await redis.incr(key);
      if (value === 1) await redis.expire(key, windowSeconds);
      return { totalHits: value, resetTime: new Date(Date.now() + windowMs) };
    },
    async decrement(key) {
      try {
        const redis = await getRedisClient();
        await redis.decr(key);
      } catch {
        // ignore
      }
    },
    async resetKey(key) {
      try {
        const redis = await getRedisClient();
        await redis.del(key);
      } catch {
        // ignore
      }
    },
  };
}

// ============================================================
// Rate Limiters
// ============================================================

const LOGIN_WINDOW_MS = 15 * 60 * 1000;     // 15 minutes
const REGISTER_WINDOW_MS = 60 * 60 * 1000;  // 1 hour
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Strict limiter for login: 5 attempts per 15 minutes per IP. */
const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(LOGIN_WINDOW_MS),
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  handler: (req, res, next, options) => {
    logger.warn({ msg: 'Login rate limit atingido', ip: req.ip });
    return next(AppError.tooManyRequests(options.message.message));
  },
});

/** Registration limiter: 10 requests per hour per IP. */
const registerLimiter = rateLimit({
  windowMs: REGISTER_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(REGISTER_WINDOW_MS),
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas de registro. Tente novamente em 1 hora.' },
  handler: (req, res, next, options) => {
    logger.warn({ msg: 'Register rate limit atingido', ip: req.ip });
    return next(AppError.tooManyRequests(options.message.message));
  },
});

/** Forgot-password limiter: 3 requests per hour, keyed by email (falls back to IP). */
const forgotPasswordLimiter = rateLimit({
  windowMs: FORGOT_PASSWORD_WINDOW_MS,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(FORGOT_PASSWORD_WINDOW_MS),
  keyGenerator: (req) => req.body?.email || req.ip,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente novamente em 1 hora.' },
  handler: (req, res, next, options) => {
    logger.warn({ msg: 'Forgot-password rate limit atingido', ip: req.ip });
    return next(AppError.tooManyRequests(options.message.message));
  },
});

/** General limiter for sensitive auth endpoints: 30 requests per 15 minutes per IP. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

// ============================================================
// Validation Schemas
// ============================================================

const RegisterSchema = z.object({
  nome: z.string().min(3).max(255),
  email: z.string().email(),
  senha: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(255)
    .regex(/[A-Z]/, 'Deve conter letra maiúscula')
    .regex(/[a-z]/, 'Deve conter letra minúscula')
    .regex(/[0-9]/, 'Deve conter número')
    .regex(/[!@#$%^&*]/, 'Deve conter caractere especial'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
  device_info: z.string().optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string().optional(),
});

const LogoutSchema = z.object({
  sessao_id: z.string().uuid().optional(),
  todas: z.boolean().optional(),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
  nova_senha: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(255)
    .regex(/[A-Z]/, 'Deve conter letra maiúscula')
    .regex(/[a-z]/, 'Deve conter letra minúscula')
    .regex(/[0-9]/, 'Deve conter número')
    .regex(/[!@#$%^&*]/, 'Deve conter caractere especial !@#$%^&*'),
});

const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
});

const ResendVerificationEmailSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

// ============================================================
// Helper: extract request metadata
// ============================================================

function getRequestMeta(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

// ============================================================
// Routes
// ============================================================

/**
 * POST /auth/register
 * Cadastro de novo usuário.
 */
router.post('/auth/register', registerLimiter, async (req, res, next) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await register(parsed.data, getRequestMeta(req));
    logger.info({ msg: 'Usuário registrado', email: parsed.data.email });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/login
 * Login e geração de tokens JWT.
 */
router.post('/auth/login', loginLimiter, async (req, res, next) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await login(parsed.data, getRequestMeta(req));

    const refreshExpiresMs = parseExpiresInSeconds(config.JWT_REFRESH_EXPIRES_IN) * 1000;
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: refreshExpiresMs,
    });

    logger.info({ msg: 'Login realizado', email: parsed.data.email });
    return res.status(200).json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      usuario: result.usuario,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/refresh
 * Renova o access token usando o refresh token (cookie ou body).
 */
router.post('/auth/refresh', authLimiter, async (req, res, next) => {
  const parsed = RefreshSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  const refreshToken = parsed.data.refreshToken || req.cookies?.refreshToken;
  if (!refreshToken) return next(AppError.badRequest('Refresh token ausente'));

  try {
    const result = await refresh(refreshToken);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/logout
 * Logout de uma ou todas as sessões.
 */
router.post('/auth/logout', authLimiter, jwtAuthMiddleware, async (req, res, next) => {
  const parsed = LogoutSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const userId = req.user.sub;
    const sessionId = req.user.sessionId;
    const result = await logout(userId, { ...parsed.data, sessionId }, getRequestMeta(req));

    res.clearCookie('refreshToken', { path: '/auth/refresh' });
    logger.info({ msg: 'Logout realizado', userId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /auth/me
 * Retorna dados do usuário autenticado.
 */
router.get('/auth/me', authLimiter, jwtAuthMiddleware, async (req, res, next) => {
  try {
    const usuario = await getMe(req.user.sub);
    return res.status(200).json(usuario);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/forgot-password
 * Inicia fluxo de recuperação de senha.
 */
router.post('/auth/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
  const parsed = ForgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await forgotPassword(parsed.data.email, getRequestMeta(req));
    logger.info({ msg: 'Forgot password requested', email: parsed.data.email });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/reset-password
 * Redefine a senha usando token de recuperação.
 */
router.post('/auth/reset-password', authLimiter, async (req, res, next) => {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await resetPassword(parsed.data, getRequestMeta(req));
    logger.info({ msg: 'Password reset completed', usuario_id: result.usuario_id });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/verify-email
 * Verifica o e-mail do usuário.
 */
router.post('/auth/verify-email', authLimiter, async (req, res, next) => {
  const parsed = VerifyEmailSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await verifyEmail(parsed.data.token, getRequestMeta(req));
    logger.info({ msg: 'Email verified', usuario_id: result.usuario_id });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/resend-verification-email
 * Reenvia e-mail de verificação.
 */
router.post('/auth/resend-verification-email', authLimiter, async (req, res, next) => {
  const parsed = ResendVerificationEmailSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await resendVerificationEmail(parsed.data.email, getRequestMeta(req));
    logger.info({ msg: 'Verification email resent', email: parsed.data.email });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
