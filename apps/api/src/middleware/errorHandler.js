import logger from '../logger.js';
import { config } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  const requestId = req.requestId || null;
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = statusCode < 500 || config.NODE_ENV !== 'production'
    ? err.message || 'An unexpected error occurred'
    : 'An unexpected error occurred';

  logger.error({
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    code,
    ...(config.NODE_ENV !== 'production' && { stack: err.stack }),
    msg: err.message,
  });

  res.status(statusCode).json({
    code,
    message,
    requestId,
  });
}
