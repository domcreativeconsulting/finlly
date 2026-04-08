import { z } from 'zod';

const STATUS_ENUM = ['pendente', 'pago', 'cancelado', 'estornado', 'falhou'];
const RECORRENCIA_ENUM = ['diario', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SORTABLE_FIELDS = ['data_vencimento', 'valor', 'descricao', 'created_at', 'status'];

export const listContasPagarQuerySchema = z.object({
  status: z.enum(STATUS_ENUM).optional(),
  categoria_id: z.string().uuid().optional(),
  conta_id: z.string().uuid().optional(),
  grupo_recorrencia_id: z.string().uuid().optional(),
  data_vencimento_de: z.string().regex(ISO_DATE_REGEX).optional(),
  data_vencimento_ate: z.string().regex(ISO_DATE_REGEX).optional(),
  busca: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
  order_by: z.enum(SORTABLE_FIELDS).default('data_vencimento'),
  order_dir: z.enum(['asc', 'desc']).default('asc'),
});

export const exportContasPagarQuerySchema = z.object({
  format: z.enum(['csv', 'pdf']).default('csv'),
  status: z.enum(STATUS_ENUM).optional(),
  categoria_id: z.string().uuid().optional(),
  conta_id: z.string().uuid().optional(),
  data_vencimento_de: z.string().regex(ISO_DATE_REGEX).optional(),
  data_vencimento_ate: z.string().regex(ISO_DATE_REGEX).optional(),
  busca: z.string().max(100).optional(),
});

export const pagarContaPagarSchema = z.object({
  data_pagamento: z.string().regex(ISO_DATE_REGEX).optional(),
  conta_id: z.string().uuid().optional(),
  observacoes: z.string().max(500).optional(),
});

export const createContaPagarSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  valor: z.number().positive(),
  data_vencimento: z.string().regex(ISO_DATE_REGEX),
  categoria_id: z.string().uuid().optional().nullable(),
  conta_id: z.string().uuid().optional().nullable(),
  recorrente: z.boolean().optional().default(false),
  recorrencia: z.enum(RECORRENCIA_ENUM).optional().nullable(),
  total_parcelas: z.number().int().min(2).max(360).optional(),
  parcelas: z.number().int().positive().max(360).optional().nullable(),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const updateContaPagarSchema = z
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
