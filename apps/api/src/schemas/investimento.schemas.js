import { z } from 'zod';

const TIPO_EVENTO_ENUM = ['aporte', 'resgate', 'rendimento', 'taxa', 'dividendo'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const listInvestimentosQuerySchema = z.object({
  status:  z.enum(['ativa', 'inativa', 'arquivada']).optional(),
  tipoId:  z.string().uuid().optional(),
  page:    z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const eventoQuerySchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  tipo:    z.enum(TIPO_EVENTO_ENUM).optional(),
});

export const createEventoSchema = z.object({
  tipo:      z.enum(TIPO_EVENTO_ENUM),
  valor:     z.number().positive(),
  data:      z.string().regex(ISO_DATE_REGEX),
  descricao: z.string().max(500).optional(),
});

export const createInvestimentoSchema = z.object({
  nome:           z.string().min(1).max(255),
  tipoId:         z.string().uuid(),
  valorInicial:   z.number().min(0).default(0).optional(),
  dataInicio:     z.string().regex(ISO_DATE_REGEX),
  dataVencimento: z.string().regex(ISO_DATE_REGEX).optional(),
  observacoes:    z.string().max(1000).optional(),
});

export const updateInvestimentoSchema = z
  .object({
    nome:           z.string().min(1).max(255).optional(),
    tipoId:         z.string().uuid().optional(),
    valorInicial:   z.number().min(0).optional(),
    dataInicio:     z.string().regex(ISO_DATE_REGEX).optional(),
    dataVencimento: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
    observacoes:    z.string().max(1000).nullable().optional(),
    status:         z.enum(['ativa', 'inativa', 'arquivada']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Pelo menos um campo deve ser informado.' });

export const createEventoInvestimentoSchema = z.object({
  tipo: z.enum(TIPO_EVENTO_ENUM),
  valor: z.number().positive(),
  data: z.string().regex(ISO_DATE_REGEX),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});
