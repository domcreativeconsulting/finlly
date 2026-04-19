import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
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
import { ensureLoggedIn, loadAssinante, ensureBillingActive } from '../middleware/authBilling.js';
import { validate } from '../middleware/validate.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { AppError } from '../errors/AppError.js';
import { listMovimentacoesQuerySchema, createMovimentacaoSchema, updateMovimentacaoSchema } from '../schemas/movimentacao.schemas.js';
import { uuidParam, uuidParamNamed } from '../schemas/shared.schemas.js';
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
  const { dateFrom, dateTo, accountId, page, perPage, sortBy, sortOrder } = req.query;
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
  try {
    const movimentacao = await createMovimentacao(req.user.sub, req.body);
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
  try {
    const movimentacao = await updateMovimentacao(req.params.id, req.user.sub, req.body);
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

router.get('/movimentacoes', readLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, validate({ query: listMovimentacoesQuerySchema }), handleList);
router.post('/movimentacoes', writeLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, auditarAcao('movimentacao_criada'), validate(createMovimentacaoSchema), handleCreate);
router.get('/movimentacoes/saldo', readLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, handleGetSaldoConsolidado);
router.get('/movimentacoes/saldo/:contaId', readLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, validate({ params: uuidParamNamed('contaId') }), handleGetSaldoConta);
router.get('/movimentacoes/:id', readLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, validate({ params: uuidParam }), handleGet);
router.put('/movimentacoes/:id', writeLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, validate({ body: updateMovimentacaoSchema, params: uuidParam }), handleUpdate);
router.patch('/movimentacoes/:id', writeLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, validate({ body: updateMovimentacaoSchema, params: uuidParam }), handleUpdate);
router.delete('/movimentacoes/:id', writeLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, auditarAcao('movimentacao_excluida', (req) => ({ id: req.params.id })), validate({ params: uuidParam }), handleDelete);

export default router;
