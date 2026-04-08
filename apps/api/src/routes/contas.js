import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import {
  listContas,
  getConta,
  createConta,
  updateConta,
  deleteConta,
} from '../services/contaService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { validate } from '../middleware/validate.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { AppError } from '../errors/AppError.js';
import { listContasQuerySchema, createContaSchema, updateContaSchema } from '../schemas/conta.schemas.js';
import { uuidParam } from '../schemas/shared.schemas.js';
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

async function handleList(req, res, next) {
  try {
    const result = await listContas(req.user.sub, req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function handleGet(req, res, next) {
  try {
    const conta = await getConta(req.params.id, req.user.sub);
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleCreate(req, res, next) {
  try {
    const conta = await createConta(req.user.sub, req.body);
    logger.info({ msg: 'Conta criada', userId: req.user.sub, contaId: conta.id });
    return res.status(201).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleUpdate(req, res, next) {
  try {
    const conta = await updateConta(req.params.id, req.user.sub, req.body);
    logger.info({ msg: 'Conta atualizada', userId: req.user.sub, contaId: req.params.id });
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleDelete(req, res, next) {
  try {
    await deleteConta(req.params.id, req.user.sub);
    logger.info({ msg: 'Conta excluída', userId: req.user.sub, contaId: req.params.id });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

router.get('/contas', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: listContasQuerySchema }), handleList);
router.post('/contas', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('conta_criada'), validate(createContaSchema), handleCreate);
router.get('/contas/:id', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleGet);
router.put('/contas/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: updateContaSchema, params: uuidParam }), handleUpdate);
router.patch('/contas/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: updateContaSchema, params: uuidParam }), handleUpdate);
router.delete('/contas/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('conta_excluida', (req) => ({ contaId: req.params.id })), validate({ params: uuidParam }), handleDelete);

export default router;
