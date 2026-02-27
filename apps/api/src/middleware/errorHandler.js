import { logger } from '../config/logger.js';
import { AppError } from '../errors/AppError.js';

const isProduction = process.env.NODE_ENV === 'production';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    logger.error({ requestId, code: err.code, httpStatus: err.httpStatus, details: err.details }, err.message);

    const payload = { code: err.code, message: err.message, requestId };
    if (!isProduction && err.details) payload.details = err.details;
    return res.status(err.httpStatus).json(payload);
  }

  if (err.name === 'ZodError' || err.status === 422) {
    const message = err.message || 'Validation error';
    logger.warn({ requestId, issues: err.errors }, message);
    return res.status(422).json({ code: 'VALIDATION_ERROR', message, requestId });
  }

  logger.error({ requestId, err }, 'Unexpected error');

  const payload = {
    code: 'INTERNAL_ERROR',
    message: isProduction ? 'Erro interno do servidor' : err.message,
    requestId,
  };
  if (!isProduction && err.stack) payload.stack = err.stack;

  return res.status(500).json(payload);
}
