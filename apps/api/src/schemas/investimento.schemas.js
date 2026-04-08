import { z } from 'zod';

const TIPO_EVENTO_ENUM = ['aporte', 'resgate', 'rendimento', 'taxa', 'dividendo'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createInvestimentoSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  tipo_id: z.string().uuid(),
  instituicao_id: z.string().uuid().optional().nullable(),
  valor_inicial: z.number().nonnegative().optional().default(0),
  data_inicio: z.string().regex(ISO_DATE_REGEX).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const updateInvestimentoSchema = z
  .object({
    nome: z.string().trim().min(1).max(255).optional(),
    tipo_id: z.string().uuid().optional(),
    instituicao_id: z.string().uuid().optional().nullable(),
    observacoes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });

export const createEventoInvestimentoSchema = z.object({
  tipo: z.enum(TIPO_EVENTO_ENUM),
  valor: z.number().positive(),
  data: z.string().regex(ISO_DATE_REGEX),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
