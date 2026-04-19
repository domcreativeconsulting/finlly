import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import {
  listCategorias,
  getCategoria,
  createCategoria,
  updateCategoria,
  deleteCategoria,
} from '../services/categoriaService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { ensureLoggedIn, loadAssinante, ensureBillingActive } from '../middleware/authBilling.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';
import { listCategoriasQuerySchema, createCategoriaSchema, updateCategoriaSchema } from '../schemas/categoria.schemas.js';
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

async function handleList(req, res, next) {
  try {
    const result = await listCategorias(req.user.sub, req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function handleGet(req, res, next) {
  try {
    const categoria = await getCategoria(req.params.id, req.user.sub);
    return res.status(200).json(categoria);
  } catch (err) {
    return next(err);
  }
}

async function handleCreate(req, res, next) {
  try {
    const categoria = await createCategoria(req.user.sub, req.body);
    logger.info({ msg: 'Categoria criada', userId: req.user.sub, categoriaId: categoria.id });
    return res.status(201).json(categoria);
  } catch (err) {
    return next(err);
  }
}

async function handleUpdate(req, res, next) {
  try {
    const categoria = await updateCategoria(req.params.id, req.user.sub, req.body);
    logger.info({ msg: 'Categoria atualizada', userId: req.user.sub, categoriaId: req.params.id });
    return res.status(200).json(categoria);
  } catch (err) {
    return next(err);
  }
}

async function handleDelete(req, res, next) {
  try {
    await deleteCategoria(req.params.id, req.user.sub);
    logger.info({ msg: 'Categoria excluída', userId: req.user.sub, categoriaId: req.params.id });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

router.get('/categorias', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: listCategoriasQuerySchema }), handleList);
router.post('/categorias', writeLimiter, jwtAuthMiddleware, requireAtivo, validate(createCategoriaSchema), handleCreate);
router.get('/categorias/:id', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleGet);
router.put('/categorias/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: updateCategoriaSchema, params: uuidParam }), handleUpdate);
router.patch('/categorias/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: updateCategoriaSchema, params: uuidParam }), handleUpdate);
router.delete('/categorias/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleDelete);

export default router;
