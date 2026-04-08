import { z } from 'zod';

const ENTIDADE_TIPOS = ['contas_pagar', 'contas_receber', 'movimentacoes_caixa', 'investimentos', 'metas'];

export const listAnexosQuerySchema = z.object({
  entidade_tipo: z.enum(ENTIDADE_TIPOS).optional(),
  entidade_id:   z.string().uuid().optional(),
  page:          z.coerce.number().int().positive().default(1),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
});

export const vinculoSchema = z.object({
  entidade_tipo: z.enum(ENTIDADE_TIPOS),
  entidade_id:   z.string().uuid(),
});

export const ocrConfirmarSchema = z.object({
  extracted_amount:      z.number().nullable().optional(),
  extracted_date:        z.string().nullable().optional(),
  extracted_description: z.string().max(500).nullable().optional(),
  extracted_type:        z.string().max(50).nullable().optional(),
});
