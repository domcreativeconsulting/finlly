import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const extratoQuerySchema = z.object({
  dateFrom:   z.string().regex(ISO_DATE_REGEX).optional(),
  dateTo:     z.string().regex(ISO_DATE_REGEX).optional(),
  accountId:  z.string().uuid().optional(),
  type:       z.enum(['IN', 'OUT']).optional(),
  originType: z.enum(['ACCOUNTS_PAYABLE', 'ACCOUNTS_RECEIVABLE', 'MANUAL']).optional(),
  q:          z.string().max(100).optional(),
  page:       z.coerce.number().int().positive().default(1),
  perPage:    z.coerce.number().int().min(1).max(100).default(20),
  sortBy:     z.enum(['date', 'amount', 'description', 'createdAt']).default('date'),
  sortOrder:  z.enum(['asc', 'desc']).default('desc'),
});

export const exportExtratoQuerySchema = z.object({
  format:     z.enum(['csv', 'pdf']).default('csv'),
  dateFrom:   z.string().regex(ISO_DATE_REGEX).optional(),
  dateTo:     z.string().regex(ISO_DATE_REGEX).optional(),
  accountId:  z.string().uuid().optional(),
  type:       z.enum(['IN', 'OUT']).optional(),
  originType: z.enum(['ACCOUNTS_PAYABLE', 'ACCOUNTS_RECEIVABLE', 'MANUAL']).optional(),
  q:          z.string().max(100).optional(),
});

export const manualMovementSchema = z.object({
  accountId:   z.string().uuid(),
  type:        z.enum(['IN', 'OUT']),
  amount:      z.number().positive(),
  date:        z.string().regex(ISO_DATE_REGEX),
  description: z.string().min(1),
  notes:       z.string().optional(),
});
