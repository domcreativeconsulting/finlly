import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';
import {
  listMetas,
  getMeta,
  createMeta,
  updateMeta,
  deleteMeta,
  createMovimento,
  deleteMovimento,
  getProgresso,
} from '../services/metaService.js';

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
const STATUS_META_ENUM = ['ativa', 'concluida', 'cancelada'];
const TIPO_META_ENUM = ['economia', 'despesa', 'investimento'];
const SORTABLE_FIELDS_GOAL = ['created_at', 'nome', 'valor_alvo', 'data_inicio', 'data_fim'];

const ListGoalsQuerySchema = z.object({
  status: z.enum(STATUS_META_ENUM).optional(),
  tipo: z.enum(TIPO_META_ENUM).optional(),
  busca: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  order_by: z.enum(SORTABLE_FIELDS_GOAL).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
});

const CreateGoalSchema = z.object({
  nome: z.string().min(1).max(255),
  tipo: z.enum(TIPO_META_ENUM),
  valor_alvo: z.number().positive(),
  data_inicio: z.string().regex(ISO_DATE_REGEX),
  data_fim: z.string().regex(ISO_DATE_REGEX).optional().nullable(),
  status: z.enum(STATUS_META_ENUM).optional(),
  icone: z.string().max(50).optional().nullable(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

const UpdateGoalSchema = CreateGoalSchema.partial();

const CreateMovimentoSchema = z.object({
  valor: z.number().positive(),
  data: z.string().regex(ISO_DATE_REGEX),
  descricao: z.string().max(255).optional().nullable(),
  movimentacao_id: z.string().uuid().optional().nullable(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/goals', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const parsed = ListGoalsQuerySchema.safeParse(req.query);
    if (!parsed.success) return next(toValidationError(parsed.error));
    const result = await listMetas(req.user.sub, parsed.data);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/goals', writeLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const parsed = CreateGoalSchema.safeParse(req.body);
    if (!parsed.success) return next(toValidationError(parsed.error));
    const result = await createMeta(req.user.sub, parsed.data);
    logger.info({ msg: 'Meta criada', userId: req.user.sub });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/goals/:id', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const result = await getMeta(req.user.sub, req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.patch('/goals/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const parsed = UpdateGoalSchema.safeParse(req.body);
    if (!parsed.success) return next(toValidationError(parsed.error));
    const result = await updateMeta(req.user.sub, req.params.id, parsed.data);
    logger.info({ msg: 'Meta atualizada', userId: req.user.sub, metaId: req.params.id });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.delete('/goals/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const result = await deleteMeta(req.user.sub, req.params.id);
    logger.info({ msg: 'Meta excluída', userId: req.user.sub, metaId: req.params.id });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/goals/:id/progress', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const result = await getProgresso(req.user.sub, req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/goals/:id/movements', writeLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const parsed = CreateMovimentoSchema.safeParse(req.body);
    if (!parsed.success) return next(toValidationError(parsed.error));
    const result = await createMovimento(req.user.sub, req.params.id, parsed.data);
    logger.info({ msg: 'Movimento de meta criado', userId: req.user.sub, metaId: req.params.id });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

router.delete('/goals/:id/movements/:movId', writeLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const result = await deleteMovimento(req.user.sub, req.params.id, req.params.movId);
    logger.info({ msg: 'Movimento de meta excluído', userId: req.user.sub, metaId: req.params.id, movId: req.params.movId });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
