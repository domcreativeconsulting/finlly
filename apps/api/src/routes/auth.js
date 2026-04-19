import { Router } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  parseExpiresInSeconds,
} from '../services/authService.js';
import {
  forgotPassword,
  resetPassword,
} from '../services/passwordRecoveryService.js';
import {
  verifyEmail,
  resendVerificationEmail,
} from '../services/emailVerificationService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { validate } from '../middleware/validate.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';
import { buildStore } from '../utils/rateLimitStore.js';
import logger from '../logger.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
} from '../schemas/auth.schemas.js';

const router = Router();

// ============================================================
// Rate Limiters
// ============================================================

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Strict limiter for login: 5 attempts per 15 minutes per IP. */
const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: 5,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(LOGIN_WINDOW_MS),
  message: {
    code: 'RATE_LIMITED',
    message: 'Muitas tentativas. Tente novamente em 15 minutos.',
  },
  handler: (req, res, next, options) => {
    logger.warn({ msg: 'Login rate limit atingido', ip: req.ip });
    return next(AppError.tooManyRequests(options.message.message));
  },
});

/** Registration limiter: 10 requests per hour per IP. */
const registerLimiter = rateLimit({
  windowMs: REGISTER_WINDOW_MS,
  max: 10,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(REGISTER_WINDOW_MS),
  message: {
    code: 'RATE_LIMITED',
    message: 'Muitas tentativas de registro. Tente novamente em 1 hora.',
  },
  handler: (req, res, next, options) => {
    logger.warn({ msg: 'Register rate limit atingido', ip: req.ip });
    return next(AppError.tooManyRequests(options.message.message));
  },
});

/** Forgot-password limiter: 3 requests per hour, keyed by email (falls back to IP). */
const forgotPasswordLimiter = rateLimit({
  windowMs: FORGOT_PASSWORD_WINDOW_MS,
  max: 3,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(FORGOT_PASSWORD_WINDOW_MS),
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req), // ← usar o helper
  message: {
    code: 'RATE_LIMITED',
    message: 'Muitas tentativas. Tente novamente em 1 hora.',
  },
  handler: (req, res, next, options) => {
    logger.warn({ msg: 'Forgot-password rate limit atingido', ip: req.ip });
    return next(AppError.tooManyRequests(options.message.message));
  },
});

/** General limiter for sensitive auth endpoints: 30 requests per 15 minutes per IP. */
const AUTH_LIMITER_WINDOW_MS = 15 * 60 * 1000;
const authLimiter = rateLimit({
  windowMs: AUTH_LIMITER_WINDOW_MS,
  max: 30,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(AUTH_LIMITER_WINDOW_MS),
  message: {
    code: 'RATE_LIMITED',
    message: 'Muitas tentativas. Tente novamente mais tarde.',
  },
  handler: (req, res, next, options) =>
    next(AppError.tooManyRequests(options.message.message)),
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
router.post('/auth/register', registerLimiter, auditarAcao('registro', (req) => ({ email: req.body?.email })), validate(registerSchema), async (req, res, next) => {
  try {
    const result = await register(req.body, getRequestMeta(req));
    logger.info({ msg: 'Usuário registrado', email: req.body.email });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/login
 * Login e geração de tokens JWT.
 */
router.post('/auth/login', loginLimiter, auditarAcao('login', (req) => ({ email: req.body?.email })), validate(loginSchema), async (req, res, next) => {
  try {
    const result = await login(req.body, getRequestMeta(req));

    const refreshExpiresMs =
      parseExpiresInSeconds(config.JWT_REFRESH_EXPIRES_IN) * 1000;
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
     sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: refreshExpiresMs,
    });

    logger.info({ msg: 'Login realizado', email: req.body.email });
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
router.post('/auth/refresh', authLimiter, validate(refreshSchema), async (req, res, next) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
  if (!refreshToken) return next(AppError.badRequest('Refresh token ausente'));

  try {
    const result = await refresh(refreshToken, getRequestMeta(req));
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/logout
 * Logout de uma ou todas as sessões.
 */
router.post(
  '/auth/logout',
  authLimiter,
  jwtAuthMiddleware,
  auditarAcao('logout'),
  validate(logoutSchema),
  async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const sessionId = req.user.sessionId;
      const result = await logout(
        userId,
        { ...req.body, sessionId },
        getRequestMeta(req)
      );

      res.clearCookie('refreshToken', { path: '/auth/refresh' });
      logger.info({ msg: 'Logout realizado', userId });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * GET /auth/me
 * Retorna dados do usuário autenticado.
 */
router.get(
  '/auth/me',
  authLimiter,
  jwtAuthMiddleware,
  async (req, res, next) => {
    try {
      const usuario = await getMe(req.user.sub);
      return res.status(200).json(usuario);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /auth/forgot-password
 * Inicia fluxo de recuperação de senha.
 */
router.post(
  '/auth/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const result = await forgotPassword(
        req.body.email,
        getRequestMeta(req)
      );
      logger.info({
        msg: 'Forgot password requested',
        email: req.body.email,
      });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /auth/reset-password
 * Redefine a senha usando token de recuperação.
 */
router.post('/auth/reset-password', authLimiter, auditarAcao('senha_alterada'), validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const result = await resetPassword(req.body, getRequestMeta(req));
    logger.info({
      msg: 'Password reset completed',
      usuario_id: result.usuario_id,
    });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /auth/verify-email
 * Verifica o e-mail do usuário.
 */
router.post('/auth/verify-email', authLimiter, validate(verifyEmailSchema), async (req, res, next) => {
  try {
    const result = await verifyEmail(req.body.token, getRequestMeta(req));
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
router.post(
  '/auth/resend-verification-email',
  authLimiter,
  validate(resendVerificationEmailSchema),
  async (req, res, next) => {
    try {
      const result = await resendVerificationEmail(
        req.body.email,
        getRequestMeta(req)
      );
      logger.info({
        msg: 'Verification email resent',
        email: req.body.email,
      });
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
