import { z } from 'zod';

const STATUS_ENUM = ['pendente', 'recebido', 'cancelado', 'estornado', 'falhou'];
const RECORRENCIA_ENUM = ['diario', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createContaReceberSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  valor: z.number().positive(),
  data_vencimento: z.string().regex(ISO_DATE_REGEX),
  categoria_id: z.string().uuid().optional().nullable(),
  conta_id: z.string().uuid().optional().nullable(),
  recorrente: z.boolean().optional().default(false),
  recorrencia: z.enum(RECORRENCIA_ENUM).optional().nullable(),
  parcelas: z.number().int().positive().max(360).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const updateContaReceberSchema = z
  .object({
    descricao: z.string().trim().min(1).max(500).optional(),
    valor: z.number().positive().optional(),
    data_vencimento: z.string().regex(ISO_DATE_REGEX).optional(),
    categoria_id: z.string().uuid().optional().nullable(),
    conta_id: z.string().uuid().optional().nullable(),
    status: z.enum(STATUS_ENUM).optional(),
    observacoes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });
