import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
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
import { ensureLoggedIn, loadAssinante, ensureBillingActive } from '../middleware/authBilling.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';
import { gerarCSV } from '../utils/csvGenerator.js';
import { gerarPDF } from '../utils/pdfGenerator.js';
import {
  listContasPagarQuerySchema,
  createContaPagarSchema,
  updateContaPagarSchema,
  pagarContaPagarSchema,
  exportContasPagarQuerySchema,
} from '../schemas/contaPagar.schemas.js';
import { uuidParam, uuidParamNamed } from '../schemas/shared.schemas.js';

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
    const result = await listContasPagar(req.user.sub, req.query);
    logger.info({ msg: 'Contas a pagar listadas', userId: req.user.sub });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function handleCreate(req, res, next) {
  try {
    const conta = await createContaPagar(req.user.sub, req.body, req.requestId);
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
  try {
    const conta = await updateContaPagar(req.params.id, req.user.sub, req.body, req.requestId);
    logger.info({ msg: 'Conta a pagar atualizada', userId: req.user.sub, contaId: req.params.id });
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleDelete(req, res, next) {
  try {
    await deleteContaPagar(req.params.id, req.user.sub, req.requestId);
    logger.info({ msg: 'Conta a pagar excluída', userId: req.user.sub, contaId: req.params.id });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

async function handlePagar(req, res, next) {
  try {
    const conta = await pagarContaPagar(req.params.id, req.user.sub, req.body, req.requestId);
    logger.info({ msg: 'Conta a pagar registrada como paga', userId: req.user.sub, contaId: req.params.id });
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleCancelar(req, res, next) {
  try {
    const conta = await cancelarContaPagar(req.params.id, req.user.sub, req.requestId);
    logger.info({ msg: 'Conta a pagar cancelada', userId: req.user.sub, contaId: req.params.id });
    return res.status(200).json(conta);
  } catch (err) {
    return next(err);
  }
}

async function handleExport(req, res, next) {
  try {
    const { format, ...filters } = req.query;
    const { data } = await listContasPagar(req.user.sub, { ...filters, page: 1, limit: 10000 });

    const now = new Date();
    const periodo = filters.data_vencimento_de || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mesRef = periodo.substring(0, 7);

const headers = ['descricao', 'valor', 'vencimento', 'status', 'categoria', 'conta', 'observacoes'];

function formatVencimento(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    const s = val.substring(0, 10); // assumes ISO-like string 'YYYY-MM-DD...'
    const parts = s.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return s;
  }
  if (val instanceof Date) {
    const s = val.toISOString().substring(0, 10);
    const parts = s.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  // fallback: coerce to string and try to extract YYYY-MM-DD
  const s = String(val).substring(0, 10);
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return s;
}

const rows = data.map((c) => [
  c.descricao || '',
  Number(c.valor).toFixed(2),
  formatVencimento(c.data_vencimento),
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
    const result = await cancelarGrupoParcelas(req.params.grupoId, req.user.sub, req.requestId);
    logger.info({ msg: 'Grupo de parcelas cancelado', userId: req.user.sub, grupoId: req.params.grupoId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

router.get('/contas-pagar', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: listContasPagarQuerySchema }), handleList);
router.post('/contas-pagar', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('contaPagar_criada'), validate(createContaPagarSchema), handleCreate);
router.get('/contas-pagar/export', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: exportContasPagarQuerySchema }), handleExport);
router.get('/contas-pagar/grupos/:grupoId', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParamNamed('grupoId') }), handleGetGrupo);
router.patch('/contas-pagar/grupos/:grupoId/cancelar', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParamNamed('grupoId') }), handleCancelarGrupo);
router.get('/contas-pagar/:id', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleGet);
router.put('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: updateContaPagarSchema, params: uuidParam }), handleUpdate);
router.patch('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: updateContaPagarSchema, params: uuidParam }), handleUpdate);
router.delete('/contas-pagar/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('contaPagar_excluida', (req) => ({ id: req.params.id })), validate({ params: uuidParam }), handleDelete);
router.post('/contas-pagar/:id/pagar', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: pagarContaPagarSchema, params: uuidParam }), handlePagar);
router.patch('/contas-pagar/:id/cancelar', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleCancelar);

export default router;
