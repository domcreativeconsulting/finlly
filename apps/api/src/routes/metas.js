import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { z } from 'zod';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { validate } from '../middleware/validate.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { AppError } from '../errors/AppError.js';
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
  listMovimentos,
} from '../services/metaService.js';
import {
  listGoalsQuerySchema,
  createGoalSchema,
  updateGoalSchema,
  createMovimentoMetaSchema,
  listMovimentosMetaQuerySchema,
} from '../schemas/meta.schemas.js';
import { uuidParam } from '../schemas/shared.schemas.js';

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

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/goals', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: listGoalsQuerySchema }), async (req, res, next) => {
  try {
    const result = await listMetas(req.user.sub, req.query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/goals', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('meta_criada'), validate(createGoalSchema), async (req, res, next) => {
  try {
    const result = await createMeta(req.user.sub, req.body);
    logger.info({ msg: 'Meta criada', userId: req.user.sub });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/goals/:id', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), async (req, res, next) => {
  try {
    const result = await getMeta(req.user.sub, req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.patch('/goals/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: updateGoalSchema, params: uuidParam }), async (req, res, next) => {
  try {
    const result = await updateMeta(req.user.sub, req.params.id, req.body);
    logger.info({ msg: 'Meta atualizada', userId: req.user.sub, metaId: req.params.id });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.delete('/goals/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('meta_excluida', (req) => ({ id: req.params.id })), validate({ params: uuidParam }), async (req, res, next) => {
  try {
    const result = await deleteMeta(req.user.sub, req.params.id);
    logger.info({ msg: 'Meta excluída', userId: req.user.sub, metaId: req.params.id });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/goals/:id/progress', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), async (req, res, next) => {
  try {
    const result = await getProgresso(req.user.sub, req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/goals/:id/movements', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: listMovimentosMetaQuerySchema, params: uuidParam }), async (req, res, next) => {
  try {
    const result = await listMovimentos(req.user.sub, req.params.id, req.query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/goals/:id/movements', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: createMovimentoMetaSchema, params: uuidParam }), async (req, res, next) => {
  try {
    const result = await createMovimento(req.user.sub, req.params.id, req.body);
    logger.info({ msg: 'Movimento de meta criado', userId: req.user.sub, metaId: req.params.id });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

router.delete('/goals/:id/movements/:movId', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: z.object({ id: z.string().uuid(), movId: z.string().uuid() }) }), async (req, res, next) => {
  try {
    const result = await deleteMovimento(req.user.sub, req.params.id, req.params.movId);
    logger.info({ msg: 'Movimento de meta excluído', userId: req.user.sub, metaId: req.params.id, movId: req.params.movId });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
