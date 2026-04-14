import { z } from 'zod';

export const subscribeSchema = z.object({
  plano:          z.enum(['mensal', 'anual']),
  ciclo:          z.enum(['mensal', 'anual']),
  formaPagamento: z.enum(['PIX', 'CREDIT_CARD']),
  cupomCodigo:    z.string().optional(),
  nome:           z.string().min(1).optional(),
  email:          z.string().email().optional(),
  cpf:            z.string().optional(),
  telefone:       z.string().optional(),
});
