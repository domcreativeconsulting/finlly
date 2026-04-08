import { z } from 'zod';

const TIPO_CONTA_ENUM = ['corrente', 'poupanca', 'investimento', 'cartao_credito', 'cartao_debito', 'dinheiro', 'outro'];
const STATUS_CONTA_ENUM = ['ativa', 'inativa', 'arquivada'];

export const createContaSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  tipo: z.enum(TIPO_CONTA_ENUM),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  icone: z.string().trim().max(50).optional().nullable(),
  incluir_total: z.boolean().optional().default(true),
  instituicao_financeira_id: z.string().uuid().optional().nullable(),
});

export const updateContaSchema = z
  .object({
    nome: z.string().trim().min(1).max(255).optional(),
    tipo: z.enum(TIPO_CONTA_ENUM).optional(),
    cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    icone: z.string().trim().max(50).optional().nullable(),
    incluir_total: z.boolean().optional(),
    status: z.enum(STATUS_CONTA_ENUM).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });
