import { rateLimit } from 'express-rate-limit';
import { buildStore, userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';

/**
 * Rate limiter for authentication endpoints (login, register, forgot-password, reset-password).
 * Configurable via RATE_LIMIT_AUTH_MAX / RATE_LIMIT_AUTH_WINDOW_MS.
 */
export const authLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_AUTH_WINDOW_MS,
  max: config.RATE_LIMIT_AUTH_MAX,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(config.RATE_LIMIT_AUTH_WINDOW_MS),
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) =>
    next(AppError.tooManyRequests(options.message.message)),
});

/**
 * Rate limiter for sensitive financial write operations.
 * Configurable via RATE_LIMIT_SENSITIVE_MAX / RATE_LIMIT_SENSITIVE_WINDOW_MS.
 */
export const sensitiveWriteLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_SENSITIVE_WINDOW_MS,
  max: config.RATE_LIMIT_SENSITIVE_MAX,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(config.RATE_LIMIT_SENSITIVE_WINDOW_MS),
  keyGenerator: (req) => req.user?.id || req.user?.sub || userOrIpKeyGenerator(req),
  message: { code: 'RATE_LIMITED', message: 'Muitas operações. Tente novamente mais tarde.' },
  handler: (req, res, next, options) =>
    next(AppError.tooManyRequests(options.message.message)),
});

/**
 * Rate limiter for administrative routes.
 * Configurable via RATE_LIMIT_ADMIN_MAX / RATE_LIMIT_ADMIN_WINDOW_MS.
 */
export const adminLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_ADMIN_WINDOW_MS,
  max: config.RATE_LIMIT_ADMIN_MAX,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(config.RATE_LIMIT_ADMIN_WINDOW_MS),
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente mais tarde.' },
  handler: (req, res, next, options) =>
    next(AppError.tooManyRequests(options.message.message)),
});
