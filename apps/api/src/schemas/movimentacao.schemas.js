import { z } from 'zod';

const TIPO_ENUM = ['entrada', 'saida', 'transferencia'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const listMovimentacoesQuerySchema = z.object({
  dateFrom:  z.string().regex(ISO_DATE_REGEX).optional(),
  dateTo:    z.string().regex(ISO_DATE_REGEX).optional(),
  accountId: z.string().uuid().optional(),
  page:      z.coerce.number().int().positive().default(1),
  perPage:   z.coerce.number().int().min(1).max(100).default(20),
  sortBy:    z.enum(['date', 'createdAt', 'amount', 'description']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createMovimentacaoSchema = z
  .object({
    conta_id:         z.string().uuid(),
    tipo:             z.enum(TIPO_ENUM),
    valor:            z.number().positive(),
    descricao:        z.string().min(1).max(500),
    data:             z.string().regex(ISO_DATE_REGEX),
    categoria_id:     z.string().uuid().optional().nullable(),
    conta_destino_id: z.string().uuid().optional(),
    observacoes:      z.string().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.tipo === 'transferencia') return !!data.conta_destino_id;
      return true;
    },
    { message: 'conta_destino_id é obrigatório para transferências', path: ['conta_destino_id'] },
  )
  .refine(
    (data) => {
      if (data.tipo === 'transferencia' && data.conta_destino_id) {
        return data.conta_id !== data.conta_destino_id;
      }
      return true;
    },
    { message: 'conta_id e conta_destino_id não podem ser iguais', path: ['conta_destino_id'] },
  );

export const updateMovimentacaoSchema = z
  .object({
    conta_id:         z.string().uuid().optional(),
    tipo:             z.enum(TIPO_ENUM).optional(),
    valor:            z.number().positive().optional(),
    descricao:        z.string().min(1).max(500).optional(),
    data:             z.string().regex(ISO_DATE_REGEX).optional(),
    categoria_id:     z.string().uuid().optional().nullable(),
    observacoes:      z.string().max(1000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });
