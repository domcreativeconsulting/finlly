import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { getExtrato } from '../services/extratoService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';
import prisma from '../utils/database.js';

const router = Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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

const ManualMovementSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(['IN', 'OUT']),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  notes: z.string().optional(),
});

async function handleCreateManual(req, res, next) {
  const parsed = ManualMovementSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  const { accountId, type, amount, date, description, notes } = parsed.data;
  const userId = req.user.sub;

  try {
    const conta = await prisma.conta.findFirst({
      where: { id: accountId, usuario_id: userId, deleted_at: null },
    });
    if (!conta) return next(AppError.forbidden('Conta não pertence ao usuário'));

    const mov = await prisma.movimentacaoCaixa.create({
      data: {
        usuario_id: userId,
        conta_id: accountId,
        tipo: type === 'IN' ? 'entrada' : 'saida',
        valor: amount,
        descricao: description,
        data: new Date(date + 'T00:00:00.000Z'),
        observacoes: notes ?? null,
        conta_pagar_id: null,
        conta_receber_id: null,
      },
    });

    logger.info({ msg: 'Lançamento manual criado', userId, contaId: accountId });

    return res.status(201).json({
      item: {
        id: mov.id,
        accountId: mov.conta_id,
        type: mov.tipo === 'entrada' ? 'IN' : 'OUT',
        amount: Number(mov.valor),
        date: mov.data.toISOString().substring(0, 10),
        description: mov.descricao,
        originType: 'MANUAL',
        createdAt: mov.created_at.toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
}

router.get('/cash-movements', readLimiter, jwtAuthMiddleware, requireAtivo, handleGetExtrato);
router.post('/cash-movements/manual', writeLimiter, jwtAuthMiddleware, requireAtivo, handleCreateManual);

export default router;
