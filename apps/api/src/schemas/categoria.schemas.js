import { z } from 'zod';

const TIPO_ENUM = ['entrada', 'saida'];

export const listCategoriasQuerySchema = z.object({
  tipo: z.enum(TIPO_ENUM).optional(),
  busca: z.string().max(100).optional(),
  include_sistema: z.coerce.boolean().optional(),
});

export const createCategoriaSchema = z.object({
  nome:   z.string().min(1).max(255),
  tipo:   z.enum(TIPO_ENUM),
  icone:  z.string().max(50).optional().nullable(),
  cor:    z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  pai_id: z.string().uuid().optional().nullable(),
});

export const updateCategoriaSchema = z
  .object({
    nome:   z.string().min(1).max(255).optional(),
    icone:  z.string().max(50).optional().nullable(),
    cor:    z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    pai_id: z.string().uuid().optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nenhum campo fornecido para atualização' });
