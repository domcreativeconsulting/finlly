import logger from '../logger.js';
import { sanitize } from '../utils/sanitize.js';

export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const sanitizedHeaders = sanitize(req.headers);
    logger.info({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userAgent: sanitizedHeaders['user-agent'],
      msg: `${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`,
    });
  });

  next();
}
