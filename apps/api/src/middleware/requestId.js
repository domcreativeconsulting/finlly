import { randomUUID } from 'crypto';
import logger from '../logger.js';

/**
 * Validates a requestId value.
 * - Max 64 characters
 * - Allowed characters: [A-Za-z0-9-_]
 * @param {string} value
 * @returns {boolean}
 */
export function isValidRequestId(value) {
  return /^[A-Za-z0-9\-_]{1,64}$/.test(value);
}

/**
 * Middleware that attaches a unique requestId to every request.
 *
 * Resolution order:
 *   1. x-request-id header (if valid)
 *   2. x-correlation-id header (if valid) — proxy/gateway compatibility
 *   3. Generated UUID v4
 *
 * Invalid headers are rejected and a new UUID is generated instead.
 */
export function requestIdMiddleware(req, res, next) {
  let requestId;

  const xRequestId = req.headers['x-request-id'];
  const xCorrelationId = req.headers['x-correlation-id'];

  if (xRequestId !== undefined) {
    if (isValidRequestId(xRequestId)) {
      requestId = xRequestId;
    } else {
      logger.warn({ receivedValue: xRequestId, msg: 'Invalid x-request-id header — generating new UUID' });
      requestId = randomUUID();
    }
  } else if (xCorrelationId !== undefined) {
    if (isValidRequestId(xCorrelationId)) {
      requestId = xCorrelationId;
    } else {
      logger.warn({ receivedValue: xCorrelationId, msg: 'Invalid x-correlation-id header — generating new UUID' });
      requestId = randomUUID();
    }
  } else {
    requestId = randomUUID();
  }

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
