import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { validate } from '../middleware/validate.js';
import logger from '../logger.js';
import {
  getKPIs,
  getEvolucaoMensal,
  getTopCategorias,
  getSaldoPorConta,
  getRelatorio,
  getDashboardMensal,
} from '../services/dashboardService.js';
import { gerarCSV } from '../utils/csvGenerator.js';
import { gerarPDF } from '../utils/pdfGenerator.js';
import {
  kpisQuerySchema,
  evolucaoQuerySchema,
  categoriasQuerySchema,
  relatorioQuerySchema,
  exportarRelatorioQuerySchema,
  monthlyQuerySchema,
} from '../schemas/dashboard.schemas.js';

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
router.get('/dashboard/kpis', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: kpisQuerySchema }), async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { dataInicio, dataFim } = req.query;

    const result = await getKPIs(usuarioId, { dataInicio, dataFim });
    logger.info({ msg: 'Dashboard KPIs consultados', userId: usuarioId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /dashboard/evolucao?meses=6
router.get('/dashboard/evolucao', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: evolucaoQuerySchema }), async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { meses } = req.query;

    const result = await getEvolucaoMensal(usuarioId, meses);
    logger.info({ msg: 'Evolução mensal consultada', userId: usuarioId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /dashboard/categorias?dataInicio=&dataFim=&tipo=saida&limit=10
router.get('/dashboard/categorias', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: categoriasQuerySchema }), async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { dataInicio, dataFim, tipo, limit } = req.query;

    const result = await getTopCategorias(usuarioId, { dataInicio, dataFim, tipo, limit });
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
router.get('/relatorios', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: relatorioQuerySchema }), async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { dataInicio, dataFim, categoriaId, contaId, tipo, page, limit } = req.query;

    const result = await getRelatorio(usuarioId, {
      dataInicio,
      dataFim,
      categoriaId,
      contaId,
      tipo,
      page,
      limit,
    });
    logger.info({ msg: 'Relatório consultado', userId: usuarioId });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /relatorios/exportar?dataInicio=&dataFim=&categoriaId=&contaId=&tipo=&format=csv|pdf
router.get('/relatorios/exportar', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: exportarRelatorioQuerySchema }), async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { dataInicio, dataFim, categoriaId, contaId, tipo, format } = req.query;

    const { data } = await getRelatorio(usuarioId, {
      dataInicio,
      dataFim,
      categoriaId,
      contaId,
      tipo,
      page: 1,
      limit: 10000,
    });

    const now = new Date();
    const dateRef = dataInicio ? dataInicio.substring(0, 10) : now.toISOString().substring(0, 10);

    const headers = ['data', 'tipo', 'valor', 'descricao', 'categoria', 'conta'];
    const rows = data.map((m) => [
      m.data ? m.data.substring(0, 10).split('-').reverse().join('/') : '',
      m.tipo || '',
      Number(m.valor).toFixed(2),
      m.descricao || '',
      m.categoria?.nome || '',
      m.conta?.nome || '',
    ]);

    const totalEntradas = data.filter((m) => m.tipo === 'entrada').reduce((acc, m) => acc + Number(m.valor), 0);
    const totalSaidas = data.filter((m) => m.tipo === 'saida').reduce((acc, m) => acc + Number(m.valor), 0);
    const resultado = totalEntradas - totalSaidas;

    if (format === 'pdf') {
      const periodoPDF = [dataInicio, dataFim].filter(Boolean).join(' a ') || dateRef;

      const pdfBuffer = await gerarPDF({
        titulo: 'Relatório Financeiro',
        periodo: periodoPDF,
        colunas: ['Data', 'Tipo', 'Valor (R$)', 'Descrição', 'Categoria', 'Conta'],
        linhas: rows,
        totalizadores: [
          { label: 'Total Entradas', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEntradas) },
          { label: 'Total Saídas', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSaidas) },
          { label: 'Resultado Líquido', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resultado) },
          { label: 'Quantidade de registros', value: String(data.length) },
        ],
      });

      logger.info({ msg: 'Relatório exportado PDF', userId: usuarioId, registros: data.length });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-${dateRef}.pdf"`);
      return res.status(200).send(pdfBuffer);
    }

    // CSV (default) — mantém compatibilidade e adiciona totalizadores no rodapé
    const csvBody = gerarCSV(headers, rows);
    const totaisLines = [
      '',
      `,,,,`,
      `Total Entradas,,${totalEntradas.toFixed(2)},,`,
      `Total Saídas,,${totalSaidas.toFixed(2)},,`,
      `Resultado Líquido,,${resultado.toFixed(2)},,`,
    ].join('\n');

    logger.info({ msg: 'Relatório exportado CSV', userId: usuarioId, registros: data.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${dateRef}.csv"`);
    return res.status(200).send(csvBody + totaisLines);
  } catch (err) {
    return next(err);
  }
});

// GET /dashboard/monthly?year=2026&month=4
router.get('/dashboard/monthly', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: monthlyQuerySchema }), async (req, res, next) => {
  try {
    const usuarioId = req.user.sub;
    const { year, month } = req.query;

    const result = await getDashboardMensal(usuarioId, { year, month });
    logger.info({ msg: 'Dashboard mensal consultado', userId: usuarioId, year, month });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
