import { AppError } from './AppError.js';

export function toValidationError(zodError) {
  const fields = {};
  zodError.errors.forEach((err) => {
    const path = err.path.join('.');
    fields[path] = err.message;
  });

  return new AppError('VALIDATION_ERROR', 'Validation failed', 422, { fields });
}
