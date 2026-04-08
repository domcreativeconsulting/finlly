import { toValidationError } from '../errors/toValidationError.js';

/**
 * Middleware factory para validação centralizada de requisições com Zod.
 *
 * Aceita:
 *   - Um Zod schema diretamente → valida req.body
 *   - Um objeto com campos opcionais `body`, `query`, `params` e/ou `headers`
 *
 * Política de campos desconhecidos:
 *   - Zod usa "strip" por padrão: campos extras em req.body são removidos silenciosamente.
 *   - Para rejeitar campos extras, use z.object({...}).strict() no schema.
 *
 * Em caso de sucesso, substitui req.body/req.query/req.params com os dados parseados (coercidos).
 * Em caso de falha, chama next(AppError) com status 422 e code VALIDATION_ERROR.
 */
export function validate(schema) {
  return (req, res, next) => {
    // Detect if schema is a shape object or a direct Zod schema.
    // A Zod schema always has a .safeParse method.
    const isZodSchema = typeof schema?.safeParse === 'function';

    const bodySchema    = isZodSchema ? schema : schema?.body;
    const querySchema   = isZodSchema ? undefined : schema?.query;
    const paramsSchema  = isZodSchema ? undefined : schema?.params;
    const headersSchema = isZodSchema ? undefined : schema?.headers;

    const allIssues = [];

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) allIssues.push(...(result.error.issues || result.error.errors || []));
      else req.body = result.data;
    }

    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) allIssues.push(...(result.error.issues || result.error.errors || []));
      else req.query = result.data;
    }

    if (paramsSchema) {
      const result = paramsSchema.safeParse(req.params);
      if (!result.success) allIssues.push(...(result.error.issues || result.error.errors || []));
      else req.params = result.data;
    }

    if (headersSchema) {
      const result = headersSchema.safeParse(req.headers);
      if (!result.success) allIssues.push(...(result.error.issues || result.error.errors || []));
    }

    if (allIssues.length > 0) return next(toValidationError({ issues: allIssues }));
    next();
  };
}
