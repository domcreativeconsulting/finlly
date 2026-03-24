import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  listContas,
  getConta,
  createConta,
  updateConta,
  deleteConta,
} from '../services/contaService.js';
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

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const TIPO_CONTA_ENUM = ['corrente', 'poupanca', 'investimento', 'cartao_credito', 'dinheiro', 'outro'];
const STATUS_CONTA_ENUM = ['ativa', 'inativa'];

const ListQuerySchema = z.object({
  status: z.enum(STATUS_CONTA_ENUM).optional(),
});

const CreateContaSchema = z.object({
  nome: z.string().min(1).max(255),
  tipo: z.enum(TIPO_CONTA_ENUM),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  icone: z.string().max(50).optional().nullable(),
  incluir_total: z.boolean().optional().default(true),
  instituicao_financeira_id: z.string().uuid().optional().nullable(),
});

const UpdateContaSchema = z
  .object({
    nome: z.string().min(1).max(255).optional(),
    tipo: z.enum(TIPO_CONTA_ENUM).optional(),
    cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
    icone: z.string().max(50).optional().nullable(),
    incluir_total: z.boolean().optional(),
    status: z.enum(STATUS_CONTA_ENUM).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });

async function handleList(req, res, next) {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(toValidationError(parsed.error));
  try {
    const result = await listContas(req.user.sub, parsed.data);
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
  const parsed = CreateContaSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));
  try {
    const conta = await createConta(req.user.sub, parsed.data);
    logger.info({ msg: 'Conta criada', userId: req.user.sub, contaId: conta.id });
    return res.status(201).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleUpdate(req, res, next) {
  const parsed = UpdateContaSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));
  try {
    const conta = await updateConta(req.params.id, req.user.sub, parsed.data);
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

router.get('/contas', readLimiter, jwtAuthMiddleware, requireAtivo, handleList);
router.post('/contas', writeLimiter, jwtAuthMiddleware, requireAtivo, handleCreate);
router.get('/contas/:id', readLimiter, jwtAuthMiddleware, requireAtivo, handleGet);
router.put('/contas/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.patch('/contas/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.delete('/contas/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleDelete);

export default router;
