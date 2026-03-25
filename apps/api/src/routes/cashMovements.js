import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { getExtrato } from '../services/extratoService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';

const router = Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ExtratoQuerySchema = z.object({
  dateFrom: z.string().regex(ISO_DATE_REGEX).optional(),
  dateTo: z.string().regex(ISO_DATE_REGEX).optional(),
  accountId: z.string().uuid().optional(),
  type: z.enum(['IN', 'OUT']).optional(),
  originType: z.enum(['ACCOUNTS_PAYABLE', 'ACCOUNTS_RECEIVABLE', 'MANUAL']).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['date', 'amount', 'description', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

async function handleGetExtrato(req, res, next) {
  const parsed = ExtratoQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await getExtrato(req.user.sub, parsed.data);
    logger.info({ msg: 'Extrato consultado', userId: req.user.sub });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

router.get('/cash-movements', readLimiter, jwtAuthMiddleware, requireAtivo, handleGetExtrato);

export default router;
