import { config } from '../config/env.js';

/**
 * CORS middleware with exact origin whitelist.
 * Compares the Origin header exactly against APP_URL to prevent subdomain bypass attacks.
 *
 * Behaviour:
 *   - No Origin header → pass through (server-to-server or same-origin requests)
 *   - Origin matches APP_URL exactly → add CORS headers; respond 204 to preflight OPTIONS
 *   - Origin present but doesn't match → respond 403 Forbidden
 *
 * @type {import('express').RequestHandler}
 */
export function corsMiddleware(req, res, next) {
  const origin = req.headers['origin'];
  const allowedOrigin = config.APP_URL.replace(/\/$/, '');

  // Not a cross-origin request — pass through
  if (!origin) return next();

  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    res.setHeader('Vary', 'Origin');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    return next();
  }

  // Origin is present but not in the allowed list
  return res.status(403).json({ code: 'FORBIDDEN', message: 'CORS policy: origin not allowed' });
}
