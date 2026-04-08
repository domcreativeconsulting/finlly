import { z } from 'zod';

const STATUS_META_ENUM = ['ativa', 'concluida', 'cancelada'];
const TIPO_META_ENUM = ['economia', 'despesa', 'investimento'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
