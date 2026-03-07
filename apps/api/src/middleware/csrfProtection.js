import { config } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

/**
 * CSRF protection middleware using Origin/Referer header validation.
 * Ensures that requests that carry cookies originate from the trusted app URL.
 * This supplements the SameSite=Strict cookie attribute for defense-in-depth.
 *
 * Should be applied to any route that relies on cookie-based authentication.
 * @type {import('express').RequestHandler}
 */
export function csrfProtection(req, res, next) {
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  // Allow requests without Origin/Referer (e.g. server-to-server calls, same-origin requests)
  if (!origin && !referer) return next();

  const allowedOrigin = config.APP_URL.replace(/\/$/, '');
  const requestOrigin = (origin || referer || '').replace(/\/$/, '');

  // The origin must start with the configured APP_URL
  if (!requestOrigin.startsWith(allowedOrigin)) {
    return next(AppError.forbidden('CSRF validation failed'));
  }

  return next();
}
