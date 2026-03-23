import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  listContasPagar,
  getContaPagar,
  createContaPagar,
  updateContaPagar,
  deleteContaPagar,
  pagarContaPagar,
  cancelarContaPagar,
} from '../services/contasPagarService.js';
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

const STATUS_ENUM = ['pendente', 'pago', 'cancelado', 'estornado', 'falhou'];
const RECORRENCIA_ENUM = ['diario', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'];
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SORTABLE_FIELDS = ['data_vencimento', 'valor', 'descricao', 'created_at', 'status'];

const ListQuerySchema = z.object({
  status: z.enum(STATUS_ENUM).optional(),
  categoria_id: z.string().uuid().optional(),
  conta_id: z.string().uuid().optional(),
  data_vencimento_de: z.string().regex(ISO_DATE_REGEX).optional(),
  data_vencimento_ate: z.string().regex(ISO_DATE_REGEX).optional(),
  busca: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
  order_by: z.enum(SORTABLE_FIELDS).default('data_vencimento'),
  order_dir: z.enum(['asc', 'desc']).default('asc'),
});

const CreateContaPagarSchema = z.object({
  descricao: z.string().min(1).max(255),
  valor: z.number().positive(),
  data_vencimento: z.string().regex(ISO_DATE_REGEX),
  categoria_id: z.string().uuid().optional().nullable(),
  conta_id: z.string().uuid().optional().nullable(),
  observacoes: z.string().max(1000).optional().nullable(),
  recorrente: z.boolean().optional().default(false),
  total_parcelas: z.number().int().min(2).max(360).optional(),
  recorrencia: z.enum(RECORRENCIA_ENUM).optional(),
});

const UpdateContaPagarSchema = z
  .object({
    descricao: z.string().min(1).max(255).optional(),
    valor: z.number().positive().optional(),
    data_vencimento: z.string().regex(ISO_DATE_REGEX).optional(),
    categoria_id: z.string().uuid().optional().nullable(),
    conta_id: z.string().uuid().optional().nullable(),
    observacoes: z.string().max(1000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nenhum campo fornecido para atualização',
  });

const PagarSchema = z.object({
  data_pagamento: z.string().regex(ISO_DATE_REGEX).optional(),
  conta_id: z.string().uuid().optional(),
  observacoes: z.string().max(500).optional(),
});

async function handleList(req, res, next) {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await listContasPagar(req.user.sub, parsed.data);
    logger.info({ msg: 'Contas a pagar listadas', userId: req.user.sub });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function handleCreate(req, res, next) {
  const parsed = CreateContaPagarSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const conta = await createContaPagar(req.user.sub, parsed.data);
    logger.info({ msg: 'Conta a pagar criada', userId: req.user.sub, contaId: conta.id });
    return res.status(201).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleGet(req, res, next) {
  try {
    const conta = await getContaPagar(req.params.id, req.user.sub);
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleUpdate(req, res, next) {
  const parsed = UpdateContaPagarSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const conta = await updateContaPagar(req.params.id, req.user.sub, parsed.data);
    logger.info({ msg: 'Conta a pagar atualizada', userId: req.user.sub, contaId: req.params.id });
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleDelete(req, res, next) {
  try {
    await deleteContaPagar(req.params.id, req.user.sub);
    logger.info({ msg: 'Conta a pagar excluída', userId: req.user.sub, contaId: req.params.id });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

async function handlePagar(req, res, next) {
  const parsed = PagarSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const conta = await pagarContaPagar(req.params.id, req.user.sub, parsed.data);
    logger.info({ msg: 'Conta a pagar registrada como paga', userId: req.user.sub, contaId: req.params.id });
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleCancelar(req, res, next) {
  try {
    const conta = await cancelarContaPagar(req.params.id, req.user.sub);
    logger.info({ msg: 'Conta a pagar cancelada', userId: req.user.sub, contaId: req.params.id });
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

router.get('/contas-pagar', readLimiter, jwtAuthMiddleware, requireAtivo, handleList);
router.post('/contas-pagar', writeLimiter, jwtAuthMiddleware, requireAtivo, handleCreate);
router.get('/contas-pagar/:id', readLimiter, jwtAuthMiddleware, requireAtivo, handleGet);
router.put('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.patch('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.delete('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleDelete);
router.post('/contas-pagar/:id/pagar', writeLimiter, jwtAuthMiddleware, requireAtivo, handlePagar);
router.patch('/contas-pagar/:id/cancelar', writeLimiter, jwtAuthMiddleware, requireAtivo, handleCancelar);

export default router;
