import { z } from 'zod';

const TIPO_ENUM = ['entrada', 'saida', 'transferencia'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createMovimentacaoSchema = z.object({
  conta_id: z.string().uuid(),
  tipo: z.enum(TIPO_ENUM),
  valor: z.number().positive(),
  descricao: z.string().trim().max(500).optional().nullable(),
  data: z.string().regex(ISO_DATE_REGEX),
  categoria_id: z.string().uuid().optional().nullable(),
  conta_destino_id: z.string().uuid().optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
  recorrente: z.boolean().optional().default(false),
});

export const updateMovimentacaoSchema = z
  .object({
    conta_id: z.string().uuid().optional(),
    tipo: z.enum(TIPO_ENUM).optional(),
    valor: z.number().positive().optional(),
    descricao: z.string().trim().max(500).optional().nullable(),
    data: z.string().regex(ISO_DATE_REGEX).optional(),
    categoria_id: z.string().uuid().optional().nullable(),
    conta_destino_id: z.string().uuid().optional().nullable(),
    observacoes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });
