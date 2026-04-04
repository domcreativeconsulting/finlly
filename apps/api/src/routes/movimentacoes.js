import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { z } from 'zod';
import {
  listMovimentacoes,
  getMovimentacao,
  createMovimentacao,
  updateMovimentacao,
  deleteMovimentacao,
  getSaldoConta,
  getSaldoConsolidado,
} from '../services/movimentacoesService.js';
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
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIPO_ENUM = ['entrada', 'saida', 'transferencia'];


const ListQuerySchema = z.object({
  dateFrom: z.string().regex(ISO_DATE_REGEX).optional(),
  dateTo: z.string().regex(ISO_DATE_REGEX).optional(),
  accountId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['date', 'createdAt', 'amount', 'description']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const CreateMovimentacaoSchema = z
  .object({
    conta_id: z.string().uuid(),
    tipo: z.enum(TIPO_ENUM),
    valor: z.number().positive(),
    descricao: z.string().min(1).max(500),
    data: z.string().regex(ISO_DATE_REGEX),
    categoria_id: z.string().uuid().optional().nullable(),
    conta_destino_id: z.string().uuid().optional(),
    observacoes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.tipo === 'transferencia') {
        return !!data.conta_destino_id;
      }
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

const UpdateMovimentacaoSchema = z
  .object({
    conta_id: z.string().uuid().optional(),
    tipo: z.enum(TIPO_ENUM).optional(),
    valor: z.number().positive().optional(),
    descricao: z.string().min(1).max(500).optional(),
    data: z.string().regex(ISO_DATE_REGEX).optional(),
    categoria_id: z.string().uuid().optional().nullable(),
    observacoes: z.string().max(1000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });

async function handleList(req, res, next) {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(toValidationError(parsed.error));

  const { dateFrom, dateTo, accountId, page, perPage, sortBy, sortOrder } = parsed.data;
  const userId = req.user.sub;

  try {
    const result = await listMovimentacoes(userId, {
      dateFrom,
      dateTo,
      accountId,
      page,
      perPage,
      sortBy,
      sortOrder,
    });
    logger.info({ msg: 'GET /movimentacoes', userId, page, perPage });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function handleCreate(req, res, next) {
  const parsed = CreateMovimentacaoSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const movimentacao = await createMovimentacao(req.user.sub, parsed.data);
    logger.info({ msg: 'Movimentação criada', userId: req.user.sub });
    return res.status(201).json(movimentacao);
  } catch (err) {
    return next(err);
  }
}

async function handleGetSaldoConsolidado(req, res, next) {
  try {
    const saldo = await getSaldoConsolidado(req.user.sub);
    return res.status(200).json(saldo);
  } catch (err) {
    return next(err);
  }
}

async function handleGetSaldoConta(req, res, next) {
  try {
    const saldo = await getSaldoConta(req.params.contaId, req.user.sub);
    return res.status(200).json(saldo);
  } catch (err) {
    return next(err);
  }
}

async function handleGet(req, res, next) {
  try {
    const movimentacao = await getMovimentacao(req.params.id, req.user.sub);
    return res.status(200).json(movimentacao);
  } catch (err) {
    return next(err);
  }
}

async function handleUpdate(req, res, next) {
  const parsed = UpdateMovimentacaoSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const movimentacao = await updateMovimentacao(req.params.id, req.user.sub, parsed.data);
    logger.info({ msg: 'Movimentação atualizada', userId: req.user.sub, movimentacaoId: req.params.id });
    return res.status(200).json(movimentacao);
  } catch (err) {
    return next(err);
  }
}

async function handleDelete(req, res, next) {
  try {
    await deleteMovimentacao(req.params.id, req.user.sub);
    logger.info({ msg: 'Movimentação excluída', userId: req.user.sub, movimentacaoId: req.params.id });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

router.get('/movimentacoes', readLimiter, jwtAuthMiddleware, requireAtivo, handleList);
router.post('/movimentacoes', writeLimiter, jwtAuthMiddleware, requireAtivo, handleCreate);
router.get('/movimentacoes/saldo', readLimiter, jwtAuthMiddleware, requireAtivo, handleGetSaldoConsolidado);
router.get('/movimentacoes/saldo/:contaId', readLimiter, jwtAuthMiddleware, requireAtivo, handleGetSaldoConta);
router.get('/movimentacoes/:id', readLimiter, jwtAuthMiddleware, requireAtivo, handleGet);
router.put('/movimentacoes/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.patch('/movimentacoes/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.delete('/movimentacoes/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleDelete);

export default router;
