import { logger } from '../config/logger.js';

export function loggerMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[level]({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      durationMs,
    }, 'request completed');
  });

  next();
}
