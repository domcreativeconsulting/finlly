import { rateLimit } from 'express-rate-limit';
import { buildStore, userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';

const AUTH_WINDOW_MS = Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000;
const AUTH_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX) || 10;
const SENSITIVE_WINDOW_MS = Number(process.env.RATE_LIMIT_SENSITIVE_WINDOW_MS) || 60 * 1000;
const SENSITIVE_MAX = Number(process.env.RATE_LIMIT_SENSITIVE_MAX) || 30;

/**
 * Rate limiter for authentication endpoints (login, register, forgot-password, reset-password).
 * 10 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: AUTH_MAX,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(AUTH_WINDOW_MS),
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) =>
    next(AppError.tooManyRequests(options.message.message)),
});

/**
 * Rate limiter for sensitive financial write operations.
 * 30 requests per minute, keyed by authenticated user id (falls back to IP).
 */
export const sensitiveWriteLimiter = rateLimit({
  windowMs: SENSITIVE_WINDOW_MS,
  max: SENSITIVE_MAX,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(SENSITIVE_WINDOW_MS),
  keyGenerator: (req) => req.user?.id || req.user?.sub || userOrIpKeyGenerator(req),
  message: { code: 'RATE_LIMITED', message: 'Muitas operações. Tente novamente mais tarde.' },
  handler: (req, res, next, options) =>
    next(AppError.tooManyRequests(options.message.message)),
});

/**
 * Rate limiter for administrative routes.
 * 20 requests per minute per user/IP.
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(60 * 1000),
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente mais tarde.' },
  handler: (req, res, next, options) =>
    next(AppError.tooManyRequests(options.message.message)),
});
