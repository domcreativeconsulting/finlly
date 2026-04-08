import { z } from 'zod';

export const subscribeSchema = z.object({
  plano:          z.enum(['mensal', 'anual']),
  ciclo:          z.enum(['mensal', 'anual']),
  formaPagamento: z.enum(['PIX', 'CREDIT_CARD']),
  cupomCodigo:    z.string().optional(),
});
