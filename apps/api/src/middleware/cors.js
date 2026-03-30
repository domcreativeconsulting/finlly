import { config } from '../config/env.js';

/**
 * CORS middleware with exact origin whitelist supporting multiple origins.
 * Compares the Origin header against the list of allowed origins to prevent subdomain bypass attacks.
 *
 * Allowed origins are configured via CORS_ORIGINS (comma-separated) or fall back to APP_URL.
 *
 * Behaviour:
 *   - No Origin header → pass through (server-to-server or same-origin requests)
 *   - Origin is in the allowed list → add CORS headers; respond 204 to preflight OPTIONS
 *   - Origin present but not in the list → respond 403 Forbidden
 *
 * @type {import('express').RequestHandler}
 */
export function corsMiddleware(req, res, next) {
  const origin = req.headers['origin'];

  // Build set of allowed origins from CORS_ORIGINS or fall back to APP_URL
  const allowedOrigins = config.CORS_ORIGINS
    ? new Set(config.CORS_ORIGINS.split(',').map((o) => o.trim().replace(/\/$/, '')))
    : new Set([config.APP_URL.replace(/\/$/, '')]);

  // Not a cross-origin request — pass through
  if (!origin) return next();

  if (allowedOrigins.has(origin)) {
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
