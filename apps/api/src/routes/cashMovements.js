import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { getExtrato } from '../services/extratoService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { ensureLoggedIn, loadAssinante, ensureBillingActive } from '../middleware/authBilling.js';
import { validate } from '../middleware/validate.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';
import prisma from '../utils/database.js';
import { gerarCSV } from '../utils/csvGenerator.js';
import { gerarPDF } from '../utils/pdfGenerator.js';
import { extratoQuerySchema, exportExtratoQuerySchema, manualMovementSchema } from '../schemas/cashMovement.schemas.js';

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

async function handleGetExtrato(req, res, next) {
  try {
    const result = await getExtrato(req.user.sub, req.query);
    logger.info({ msg: 'Extrato consultado', userId: req.user.sub });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function handleExportExtrato(req, res, next) {
  try {
    const { format, ...filters } = req.query;
    const result = await getExtrato(req.user.sub, { ...filters, page: 1, perPage: 10000 });
    const items = result.items ?? [];

    const now = new Date();
    const fromLabel = filters.dateFrom || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const toLabel = filters.dateTo || now.toISOString().substring(0, 10);
    const filenameBase = `extrato-${fromLabel}_a_${toLabel}`;

    const ORIGIN_LABELS = {
      ACCOUNTS_PAYABLE: 'Conta a pagar',
      ACCOUNTS_RECEIVABLE: 'Conta a receber',
      MANUAL: 'Manual',
    };

    const headers = ['data', 'descricao', 'conta', 'tipo', 'origem', 'valor'];
    const rows = items.map((item) => [
      item.date ? item.date.substring(0, 10).split('-').reverse().join('/') : '',
      item.description || '',
      item.accountName || '',
      item.type === 'IN' ? 'Entrada' : 'Saída',
      ORIGIN_LABELS[item.originType] || item.originType || '',
      Number(item.amount).toFixed(2),
    ]);

    const totals = result.totals ?? {};

    if (format === 'pdf') {
      const pdfBuffer = await gerarPDF({
        titulo: 'Extrato Financeiro',
        periodo: `${fromLabel} a ${toLabel}`,
        colunas: ['Data', 'Descrição', 'Conta', 'Tipo', 'Origem', 'Valor (R$)'],
        linhas: rows,
        totalizadores: [
          { label: 'Total Entradas', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.totalIn ?? 0) },
          { label: 'Total Saídas', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.totalOut ?? 0) },
          { label: 'Resultado Líquido', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.balanceDelta ?? 0) },
          { label: 'Quantidade de registros', value: String(items.length) },
        ],
      });

      logger.info({ msg: 'Extrato exportado PDF', userId: req.user.sub, registros: items.length });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
      return res.status(200).send(pdfBuffer);
    }

    const csv = gerarCSV(headers, rows);
    logger.info({ msg: 'Extrato exportado CSV', userId: req.user.sub, registros: items.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
}

async function handleCreateManual(req, res, next) {
  const { accountId, type, amount, date, description, notes } = req.body;
  const userId = req.user.sub;

  try {
    const conta = await prisma.conta.findFirst({
      where: { id: accountId, usuario_id: userId, deleted_at: null },
    });
    if (!conta) return next(AppError.forbidden('Conta não pertence ao usuário'));

    const mov = await prisma.movimentacaoCaixa.create({
      data: {
        usuario_id: userId,
        conta_id: accountId,
        tipo: type === 'IN' ? 'entrada' : 'saida',
        valor: amount,
        descricao: description,
        data: new Date(date + 'T00:00:00.000Z'),
        observacoes: notes ?? null,
        conta_pagar_id: null,
        conta_receber_id: null,
      },
    });

    logger.info({ msg: 'Lançamento manual criado', userId, contaId: accountId });

    return res.status(201).json({
      item: {
        id: mov.id,
        accountId: mov.conta_id,
        type: mov.tipo === 'entrada' ? 'IN' : 'OUT',
        amount: Number(mov.valor),
        date: mov.data.toISOString().substring(0, 10),
        description: mov.descricao,
        originType: 'MANUAL',
        createdAt: mov.created_at.toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
}

router.get('/cash-movements', readLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, validate({ query: extratoQuerySchema }), handleGetExtrato);
router.get('/cash-movements/export', readLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, validate({ query: exportExtratoQuerySchema }), handleExportExtrato);
router.post('/cash-movements/manual', writeLimiter, jwtAuthMiddleware, ensureLoggedIn, loadAssinante, ensureBillingActive, auditarAcao('movimentacao_criada'), validate(manualMovementSchema), handleCreateManual);

export default router;
