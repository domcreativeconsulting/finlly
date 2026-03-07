import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { register, login, refresh, logout, getMe, parseExpiresInSeconds } from '../services/authService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { toValidationError } from '../errors/toValidationError.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';
import logger from '../logger.js';

const router = Router();

// ============================================================
// Rate Limiters
// ============================================================

/** Strict limiter for login: 5 attempts per 15 minutes per IP. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
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
router.post('/auth/register', authLimiter, async (req, res, next) => {
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

export default router;
