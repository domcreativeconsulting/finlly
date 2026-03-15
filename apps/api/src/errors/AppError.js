export class AppError extends Error {
  constructor(code, message, status = 500, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'AppError';
  }

  static badRequest(message = 'Bad request', details) {
    return new AppError('BAD_REQUEST', message, 400, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError('UNAUTHORIZED', message, 401);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError('FORBIDDEN', message, 403);
  }

  static notFound(message = 'Not found') {
    return new AppError('NOT_FOUND', message, 404);
  }

  static conflict(message = 'Conflict', details) {
    return new AppError('CONFLICT', message, 409, details);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError('TOO_MANY_REQUESTS', message, 429);
  }

  static locked(message = 'Account locked') {
    return new AppError('ACCOUNT_LOCKED', message, 423);
  }

  static internal(message = 'An unexpected error occurred') {
    return new AppError('INTERNAL_SERVER_ERROR', message, 500);
  }

  static paymentRequired(message = 'Payment required', code = 'PAYMENT_REQUIRED') {
    return new AppError(code, message, 402);
  }
}
