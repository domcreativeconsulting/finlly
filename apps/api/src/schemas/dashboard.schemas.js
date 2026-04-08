import { z } from 'zod';
import { isoDateString, optionalIsoDateString } from './shared.schemas.js';

const optionalIsoDate = optionalIsoDateString;

export const kpisQuerySchema = z.object({
  dataInicio: isoDateString,
  dataFim:    isoDateString,
});

export const evolucaoQuerySchema = z.object({
  meses: z.coerce.number().int().min(1).max(24).default(6),
});

export const categoriasQuerySchema = z.object({
  dataInicio: isoDateString,
  dataFim:    isoDateString,
  tipo:       z.enum(['entrada', 'saida']).default('saida'),
  limit:      z.coerce.number().int().min(1).max(50).default(10),
});

export const relatorioQuerySchema = z.object({
  dataInicio:  optionalIsoDate,
  dataFim:     optionalIsoDate,
  categoriaId: z.string().uuid().optional(),
  contaId:     z.string().uuid().optional(),
  tipo:        z.enum(['entrada', 'saida', 'transferencia']).optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().min(1).max(10000).default(50),
});

export const exportarRelatorioQuerySchema = z.object({
  dataInicio:  optionalIsoDate,
  dataFim:     optionalIsoDate,
  categoriaId: z.string().uuid().optional(),
  contaId:     z.string().uuid().optional(),
  tipo:        z.enum(['entrada', 'saida', 'transferencia']).optional(),
  format:      z.enum(['csv', 'pdf']).default('csv'),
});

const currentYear = new Date().getFullYear();

export const monthlyQuerySchema = z.object({
  year:  z.coerce.number().int().min(2000).max(currentYear + 5).default(currentYear),
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
});
