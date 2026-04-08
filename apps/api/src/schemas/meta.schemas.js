import { z } from 'zod';

const STATUS_META_ENUM = ['ativa', 'concluida', 'cancelada'];
const TIPO_META_ENUM = ['economia', 'despesa', 'investimento'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const listGoalsQuerySchema = z.object({
  status:    z.enum(STATUS_META_ENUM).optional(),
  tipo:      z.enum(TIPO_META_ENUM).optional(),
  busca:     z.string().max(100).optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  order_by:  z.enum(['created_at', 'nome', 'valor_alvo', 'data_inicio', 'data_fim']).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
});

export const createMovimentoMetaSchema = z.object({
  valor:           z.number().positive(),
  data:            z.string().regex(ISO_DATE_REGEX),
  descricao:       z.string().max(255).optional().nullable(),
  movimentacao_id: z.string().uuid().optional().nullable(),
});

export const listMovimentosMetaQuerySchema = z.object({
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
});

export const createGoalSchema = z.object({
  nome:        z.string().min(1).max(255),
  tipo:        z.enum(TIPO_META_ENUM),
  valor_alvo:  z.number().positive(),
  data_inicio: z.string().regex(ISO_DATE_REGEX),
  data_fim:    z.string().regex(ISO_DATE_REGEX).optional().nullable(),
  status:      z.enum(STATUS_META_ENUM).optional(),
  icone:       z.string().max(50).optional().nullable(),
  cor:         z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const createMetaSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  tipo: z.enum(TIPO_META_ENUM).default('economia'),
  valor_alvo: z.number().positive(),
  data_limite: z.string().regex(ISO_DATE_REGEX).optional().nullable(),
  descricao: z.string().trim().max(1000).optional().nullable(),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  icone: z.string().trim().max(50).optional().nullable(),
});

export const updateMetaSchema = z
  .object({
    nome: z.string().trim().min(1).max(255).optional(),
    tipo: z.enum(TIPO_META_ENUM).optional(),
    valor_alvo: z.number().positive().optional(),
    data_limite: z.string().regex(ISO_DATE_REGEX).optional().nullable(),
    descricao: z.string().trim().max(1000).optional().nullable(),
    cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    icone: z.string().trim().max(50).optional().nullable(),
    status: z.enum(STATUS_META_ENUM).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });
