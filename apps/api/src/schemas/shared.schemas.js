import { z } from 'zod';

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Valida { id: uuid } em req.params */
export const uuidParam = z.object({ id: z.string().uuid('ID inválido') });

/** Cria schema de params com UUID para qualquer nome de param */
export const uuidParamNamed = (paramName) =>
  z.object({ [paramName]: z.string().uuid(`${paramName} inválido`) });

/** Paginação com `limit` */
export const paginationSchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Paginação com `perPage` */
export const paginationPerPageSchema = z.object({
  page:    z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const isoDateString         = z.string().regex(ISO_DATE_REGEX);
export const optionalIsoDateString = z.string().regex(ISO_DATE_REGEX).optional();
export const optionalUuid          = z.string().uuid().optional().nullable();
export const moneyPositive         = z.number().positive();
export const sortOrderSchema       = z.enum(['asc', 'desc']).default('desc');
