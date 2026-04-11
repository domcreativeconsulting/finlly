import { randomUUID } from 'node:crypto';

/**
 * Enriches res.locals with request context for use in audit logging.
 *
 * Uses req.requestId if already set (e.g. by requestIdMiddleware),
 * otherwise reads x-request-id header or generates a new UUID.
 * Always sets res.locals.requestId, res.locals.ip and res.locals.userAgent.
 */
export function requestContextMiddleware(req, res, next) {
  const requestId = req.requestId || req.headers['x-request-id'] || randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.locals.requestId = requestId;
  res.locals.ip = req.ip || req.socket?.remoteAddress;
  res.locals.userAgent = req.headers['user-agent'];

  next();
}
