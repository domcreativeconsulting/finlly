import { AppError } from './AppError.js';

export function toValidationError(zodError) {
  const fields = {};
  // Support both Zod v4 (.issues) and earlier versions (.errors)
  const issues = zodError.issues || zodError.errors;
  issues.forEach((err) => {
    const path = err.path.join('.');
    fields[path] = err.message;
  });

  return new AppError('VALIDATION_ERROR', 'Validation failed', 422, { fields });
}
