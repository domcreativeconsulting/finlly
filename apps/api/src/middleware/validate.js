import { toValidationError } from '../errors/toValidationError.js';

/**
 * Middleware factory para validação centralizada de requisições com Zod.
 *
 * Accepts either:
 *   - A single Zod schema → validates req.body
 *   - An object with optional `body`, `query`, and/or `params` Zod schemas
 *
 * On success, replaces req.body/req.query/req.params with the parsed (coerced) values.
 * On failure, calls next(AppError) with status 422 and VALIDATION_ERROR code.
 *
 * @param {import('zod').ZodTypeAny | { body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schema
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
  return (req, res, next) => {
    // Detect if schema is a shape object or a direct Zod schema.
    // A Zod schema always has a .safeParse method.
    const isZodSchema = typeof schema?.safeParse === 'function';

    const bodySchema = isZodSchema ? schema : schema?.body;
    const querySchema = isZodSchema ? undefined : schema?.query;
    const paramsSchema = isZodSchema ? undefined : schema?.params;

    const allIssues = [];

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        allIssues.push(...(result.error.issues || result.error.errors || []));
      } else {
        req.body = result.data;
      }
    }

    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        allIssues.push(...(result.error.issues || result.error.errors || []));
      } else {
        req.query = result.data;
      }
    }

    if (paramsSchema) {
      const result = paramsSchema.safeParse(req.params);
      if (!result.success) {
        allIssues.push(...(result.error.issues || result.error.errors || []));
      } else {
        req.params = result.data;
      }
    }

    if (allIssues.length > 0) {
      return next(toValidationError({ issues: allIssues }));
    }

    next();
  };
}
