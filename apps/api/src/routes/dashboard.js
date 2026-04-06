import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import logger from '../logger.js';
import {
  getKPIs,
  getEvolucaoMensal,
  getTopCategorias,
  getSaldoPorConta,
  getRelatorio,
} from '../services/dashboardService.js';

const router = Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
});

// GET /dashboard/kpis?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
router.get('/dashboard/kpis', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'dataInicio e dataFim são obrigatórios' });
    }

    const result = await getKPIs(usuarioId, { dataInicio, dataFim });
    logger.info({ msg: 'Dashboard KPIs consultados', userId: usuarioId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /dashboard/evolucao?meses=6
router.get('/dashboard/evolucao', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const meses = Math.min(Math.max(parseInt(req.query.meses) || 6, 1), 24);

    const result = await getEvolucaoMensal(usuarioId, meses);
    logger.info({ msg: 'Evolução mensal consultada', userId: usuarioId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /dashboard/categorias?dataInicio=&dataFim=&tipo=saida&limit=10
router.get('/dashboard/categorias', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { dataInicio, dataFim, tipo = 'saida', limit = '10' } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'dataInicio e dataFim são obrigatórios' });
    }

    const result = await getTopCategorias(usuarioId, {
      dataInicio,
      dataFim,
      tipo,
      limit: Math.min(parseInt(limit) || 10, 50),
    });
    logger.info({ msg: 'Top categorias consultadas', userId: usuarioId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /dashboard/contas
router.get('/dashboard/contas', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const result = await getSaldoPorConta(usuarioId);
    logger.info({ msg: 'Saldo por conta consultado', userId: usuarioId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /relatorios?dataInicio=&dataFim=&categoriaId=&contaId=&tipo=&page=1&limit=50
router.get('/relatorios', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { dataInicio, dataFim, categoriaId, contaId, tipo, page, limit } = req.query;

    const result = await getRelatorio(usuarioId, {
      dataInicio,
      dataFim,
      categoriaId,
      contaId,
      tipo,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    logger.info({ msg: 'Relatório consultado', userId: usuarioId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /relatorios/exportar?dataInicio=&dataFim=&categoriaId=&contaId=&tipo=
router.get('/relatorios/exportar', readLimiter, jwtAuthMiddleware, requireAtivo, async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { dataInicio, dataFim, categoriaId, contaId, tipo } = req.query;

    const { data } = await getRelatorio(usuarioId, {
      dataInicio,
      dataFim,
      categoriaId,
      contaId,
      tipo,
      page: 1,
      limit: 10000,
    });

    const header = 'data,tipo,valor,descricao,categoria,conta';
    const rows = data.map((m) => {
      const data_fmt = m.data ? new Date(m.data).toISOString().split('T')[0] : '';
      const descricao = (m.descricao || '').replace(/"/g, '""');
      const categoria = (m.categoria?.nome || '').replace(/"/g, '""');
      const conta = (m.conta?.nome || '').replace(/"/g, '""');
      return `${data_fmt},${m.tipo},${m.valor},"${descricao}","${categoria}","${conta}"`;
    });

    const csv = [header, ...rows].join('\n');

    logger.info({ msg: 'Relatório exportado CSV', userId: usuarioId, registros: data.length });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
});

export default router;
