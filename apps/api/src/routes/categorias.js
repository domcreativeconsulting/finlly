import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { z } from 'zod';
import {
  listCategorias,
  getCategoria,
  createCategoria,
  updateCategoria,
  deleteCategoria,
} from '../services/categoriaService.js';
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

const TIPO_ENUM = ['entrada', 'saida'];

const ListQuerySchema = z.object({
  tipo: z.enum(TIPO_ENUM).optional(),
  busca: z.string().max(100).optional(),
  include_sistema: z.coerce.boolean().optional(),
});

const CreateCategoriaSchema = z.object({
  nome: z.string().min(1).max(255),
  tipo: z.enum(TIPO_ENUM),
  icone: z.string().max(50).optional().nullable(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  pai_id: z.string().uuid().optional().nullable(),
});

const UpdateCategoriaSchema = z
  .object({
    nome: z.string().min(1).max(255).optional(),
    icone: z.string().max(50).optional().nullable(),
    cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    pai_id: z.string().uuid().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });

async function handleList(req, res, next) {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(toValidationError(parsed.error));
  try {
    const result = await listCategorias(req.user.sub, parsed.data);
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
  const parsed = CreateCategoriaSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));
  try {
    const categoria = await createCategoria(req.user.sub, parsed.data);
    logger.info({ msg: 'Categoria criada', userId: req.user.sub, categoriaId: categoria.id });
    return res.status(201).json(categoria);
  } catch (err) {
    return next(err);
  }
}

async function handleUpdate(req, res, next) {
  const parsed = UpdateCategoriaSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));
  try {
    const categoria = await updateCategoria(req.params.id, req.user.sub, parsed.data);
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

router.get('/categorias', readLimiter, jwtAuthMiddleware, requireAtivo, handleList);
router.post('/categorias', writeLimiter, jwtAuthMiddleware, requireAtivo, handleCreate);
router.get('/categorias/:id', readLimiter, jwtAuthMiddleware, requireAtivo, handleGet);
router.put('/categorias/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.patch('/categorias/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.delete('/categorias/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleDelete);

export default router;
