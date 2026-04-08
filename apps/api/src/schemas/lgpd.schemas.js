import { z } from 'zod';

export const confirmDeleteSchema = z.object({
  senha: z.string().min(1, 'Senha obrigatória'),
});
