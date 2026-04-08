import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { z } from 'zod';
import {
  listContasPagar,
  getContaPagar,
  createContaPagar,
  updateContaPagar,
  deleteContaPagar,
  pagarContaPagar,
  cancelarContaPagar,
  getGrupoParcelas,
  cancelarGrupoParcelas,
} from '../services/contasPagarService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import { config } from '../config/env.js';
import logger from '../logger.js';
import { gerarCSV } from '../utils/csvGenerator.js';
import { gerarPDF } from '../utils/pdfGenerator.js';

const router = Router();

const readLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_READ_WINDOW_MS,
  max: config.RATE_LIMIT_READ_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const writeLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WRITE_WINDOW_MS,
  max: config.RATE_LIMIT_WRITE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
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
  grupo_recorrencia_id: z.string().uuid().optional(),
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

const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'pdf']).default('csv'),
  status: z.enum(STATUS_ENUM).optional(),
  categoria_id: z.string().uuid().optional(),
  conta_id: z.string().uuid().optional(),
  data_vencimento_de: z.string().regex(ISO_DATE_REGEX).optional(),
  data_vencimento_ate: z.string().regex(ISO_DATE_REGEX).optional(),
  busca: z.string().max(100).optional(),
});

async function handleExport(req, res, next) {
  const parsed = ExportQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const { format, ...filters } = parsed.data;
    const { data } = await listContasPagar(req.user.sub, { ...filters, page: 1, limit: 10000 });

    const now = new Date();
    const periodo = filters.data_vencimento_de || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mesRef = periodo.substring(0, 7);

    const headers = ['descricao', 'valor', 'vencimento', 'status', 'categoria', 'conta', 'observacoes'];
    const rows = data.map((c) => [
      c.descricao || '',
      Number(c.valor).toFixed(2),
      c.data_vencimento ? c.data_vencimento.substring(0, 10).split('-').reverse().join('/') : '',
      c.status || '',
      c.categoria?.nome || '',
      c.conta?.nome || '',
      c.observacoes || '',
    ]);

    if (format === 'pdf') {
      const totalGeral = data.reduce((acc, c) => acc + Number(c.valor), 0);
      const periodoPDF = [filters.data_vencimento_de, filters.data_vencimento_ate]
        .filter(Boolean)
        .join(' a ') || mesRef;

      const pdfBuffer = await gerarPDF({
        titulo: 'Contas a Pagar',
        periodo: periodoPDF,
        colunas: ['Descrição', 'Valor (R$)', 'Vencimento', 'Status', 'Categoria', 'Conta', 'Observações'],
        linhas: rows,
        totalizadores: [
          { label: 'Total geral', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeral) },
          { label: 'Quantidade de registros', value: String(data.length) },
        ],
      });

      logger.info({ msg: 'Contas a pagar exportadas PDF', userId: req.user.sub, registros: data.length });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contas-pagar-${mesRef}.pdf"`);
      return res.status(200).send(pdfBuffer);
    }

    const csv = gerarCSV(headers, rows);
    logger.info({ msg: 'Contas a pagar exportadas CSV', userId: req.user.sub, registros: data.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contas-pagar-${mesRef}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
}

async function handleGetGrupo(req, res, next) {
  try {
    const parcelas = await getGrupoParcelas(req.params.grupoId, req.user.sub);
    return res.status(200).json(parcelas);
  } catch (err) {
    return next(err);
  }
}

async function handleCancelarGrupo(req, res, next) {
  try {
    const result = await cancelarGrupoParcelas(req.params.grupoId, req.user.sub);
    logger.info({ msg: 'Grupo de parcelas cancelado', userId: req.user.sub, grupoId: req.params.grupoId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

router.get('/contas-pagar', readLimiter, jwtAuthMiddleware, requireAtivo, handleList);
router.post('/contas-pagar', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('contaPagar_criada'), handleCreate);
router.get('/contas-pagar/export', readLimiter, jwtAuthMiddleware, requireAtivo, handleExport);
router.get('/contas-pagar/grupos/:grupoId', readLimiter, jwtAuthMiddleware, requireAtivo, handleGetGrupo);
router.patch('/contas-pagar/grupos/:grupoId/cancelar', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('grupoParcelas_cancelado', (req) => ({ grupoId: req.params.grupoId })), handleCancelarGrupo);
router.get('/contas-pagar/:id', readLimiter, jwtAuthMiddleware, requireAtivo, handleGet);
router.put('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('contaPagar_atualizada', (req) => ({ id: req.params.id })), handleUpdate);
router.patch('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('contaPagar_atualizada', (req) => ({ id: req.params.id })), handleUpdate);
router.delete('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('contaPagar_excluida', (req) => ({ id: req.params.id })), handleDelete);
router.post('/contas-pagar/:id/pagar', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('contaPagar_paga', (req) => ({ id: req.params.id })), handlePagar);
router.patch('/contas-pagar/:id/cancelar', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('contaPagar_cancelada', (req) => ({ id: req.params.id })), handleCancelar);

export default router;
