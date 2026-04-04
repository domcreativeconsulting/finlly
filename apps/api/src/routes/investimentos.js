import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { z } from 'zod';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';
import prisma from '../utils/database.js';
import { calcularPosicao } from '../services/investimentoService.js';

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

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatEvento(ev) {
  return {
    id: ev.id,
    investmentId: ev.investimento_id,
    type: ev.tipo,
    amount: Number(ev.valor),
    date: new Date(ev.data).toISOString().substring(0, 10),
    description: ev.descricao ?? null,
    createdAt: ev.created_at,
    updatedAt: ev.updated_at,
  };
}

function formatInvestimento(inv) {
  return {
    id: inv.id,
    nome: inv.nome,
    status: inv.status,
    valorInicial: Number(inv.valor_inicial),
    dataInicio: inv.data_inicio ? String(inv.data_inicio).substring(0, 10) : null,
    dataVencimento: inv.data_vencimento ? String(inv.data_vencimento).substring(0, 10) : null,
    observacoes: inv.observacoes ?? null,
    tipoId: inv.tipo_id,
    tipoNome: inv.tipo?.nome ?? null,
    totalEventos: inv._count?.eventos ?? 0,
    createdAt: inv.created_at,
  };
}

// ─── Query schemas ───────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  status: z.enum(['ativa', 'inativa', 'arquivada']).optional(),
  tipoId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

const CreateSchema = z.object({
  nome: z.string().min(1).max(255),
  tipoId: z.string().uuid(),
  valorInicial: z.number().min(0).default(0).optional(),
  dataInicio: z.string().regex(ISO_DATE_REGEX),
  dataVencimento: z.string().regex(ISO_DATE_REGEX).optional(),
  observacoes: z.string().max(1000).optional(),
});

const UpdateSchema = z
  .object({
    nome: z.string().min(1).max(255).optional(),
    tipoId: z.string().uuid().optional(),
    valorInicial: z.number().min(0).optional(),
    dataInicio: z.string().regex(ISO_DATE_REGEX).optional(),
    dataVencimento: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
    observacoes: z.string().max(1000).nullable().optional(),
    status: z.enum(['ativa', 'inativa', 'arquivada']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Pelo menos um campo deve ser informado.' });

const EventoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  tipo: z.enum(['aporte', 'resgate', 'rendimento', 'taxa', 'dividendo']).optional(),
});

const CreateEventoSchema = z.object({
  tipo: z.enum(['aporte', 'resgate', 'rendimento', 'taxa', 'dividendo']),
  valor: z.number().positive(),
  data: z.string().regex(ISO_DATE_REGEX),
  descricao: z.string().max(500).optional(),
});

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleListTipos(req, res, next) {
  try {
    const tipos = await prisma.tipoInvestimento.findMany({
      where: { deleted_at: null },
      orderBy: { nome: 'asc' },
    });
    return res.status(200).json({
      items: tipos.map((t) => ({ id: t.id, nome: t.nome, descricao: t.descricao ?? null })),
    });
  } catch (err) {
    return next(err);
  }
}

async function handleList(req, res, next) {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(toValidationError(parsed.error));

  const { status, tipoId, page, perPage } = parsed.data;
  const userId = req.user.sub;

  try {
    const where = { usuario_id: userId, deleted_at: null };
    if (status) where.status = status;
    if (tipoId) where.tipo_id = tipoId;

    const [items, total] = await Promise.all([
      prisma.investimento.findMany({
        where,
        include: {
          tipo: { select: { id: true, nome: true } },
          _count: { select: { eventos: { where: { deleted_at: null } } } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.investimento.count({ where }),
    ]);

    return res.status(200).json({
      items: items.map(formatInvestimento),
      total,
      page,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return next(err);
  }
}

async function handleCreate(req, res, next) {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  const { nome, tipoId, valorInicial = 0, dataInicio, dataVencimento, observacoes } = parsed.data;
  const userId = req.user.sub;

  try {
    const tipo = await prisma.tipoInvestimento.findFirst({ where: { id: tipoId, deleted_at: null } });
    if (!tipo) return next(AppError.badRequest('Tipo de investimento não encontrado.'));

    const inv = await prisma.investimento.create({
      data: {
        usuario_id: userId,
        nome,
        tipo_id: tipoId,
        valor_inicial: valorInicial,
        data_inicio: new Date(dataInicio + 'T00:00:00.000Z'),
        data_vencimento: dataVencimento ? new Date(dataVencimento + 'T00:00:00.000Z') : null,
        observacoes: observacoes ?? null,
        status: 'ativa',
      },
      include: { tipo: { select: { id: true, nome: true } }, _count: { select: { eventos: true } } },
    });

    logger.info({ msg: 'Investimento criado', userId, investimentoId: inv.id });

    return res.status(201).json({ item: formatInvestimento(inv) });
  } catch (err) {
    return next(err);
  }
}

async function handleGet(req, res, next) {
  const userId = req.user.sub;
  const { id } = req.params;

  try {
    const inv = await prisma.investimento.findFirst({
      where: { id, usuario_id: userId, deleted_at: null },
      include: {
        tipo: { select: { id: true, nome: true } },
        eventos: {
          where: { deleted_at: null },
          orderBy: { data: 'desc' },
        },
        _count: { select: { eventos: { where: { deleted_at: null } } } },
      },
    });

    if (!inv) return next(AppError.notFound('Investimento não encontrado.'));

    const posicao = calcularPosicao(inv.eventos);
    const formatted = formatInvestimento(inv);

    return res.status(200).json({
      item: {
        ...formatted,
        posicao,
        eventos: inv.eventos.map(formatEvento),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function handleUpdate(req, res, next) {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  const userId = req.user.sub;
  const { id } = req.params;

  try {
    const inv = await prisma.investimento.findFirst({ where: { id, usuario_id: userId, deleted_at: null } });
    if (!inv) return next(AppError.notFound('Investimento não encontrado.'));

    const { nome, tipoId, valorInicial, dataInicio, dataVencimento, observacoes, status } = parsed.data;

    if (tipoId !== undefined) {
      const tipo = await prisma.tipoInvestimento.findFirst({ where: { id: tipoId, deleted_at: null } });
      if (!tipo) return next(AppError.badRequest('Tipo de investimento não encontrado.'));
    }

    const updateData = {};
    if (nome !== undefined) updateData.nome = nome;
    if (tipoId !== undefined) updateData.tipo_id = tipoId;
    if (valorInicial !== undefined) updateData.valor_inicial = valorInicial;
    if (dataInicio !== undefined) {
      updateData.data_inicio = new Date(dataInicio + 'T00:00:00.000Z');
    }
    if (dataVencimento !== undefined) {
      updateData.data_vencimento = dataVencimento
        ? new Date(dataVencimento + 'T00:00:00.000Z')
        : null;
    }
    if (observacoes !== undefined) updateData.observacoes = observacoes;
    if (status !== undefined) updateData.status = status;

    const updated = await prisma.investimento.update({
      where: { id },
      data: updateData,
      include: { tipo: { select: { id: true, nome: true } }, _count: { select: { eventos: { where: { deleted_at: null } } } } },
    });

    logger.info({ msg: 'Investimento atualizado', userId, investimentoId: id });

    return res.status(200).json({ item: formatInvestimento(updated) });
  } catch (err) {
    return next(err);
  }
}

async function handleDelete(req, res, next) {
  const userId = req.user.sub;
  const { id } = req.params;

  try {
    const inv = await prisma.investimento.findFirst({ where: { id, usuario_id: userId, deleted_at: null } });
    if (!inv) return next(AppError.notFound('Investimento não encontrado.'));

    const eventosAtivos = await prisma.investimentoEvento.count({
      where: { investimento_id: id, deleted_at: null },
    });

    if (eventosAtivos > 0) {
      return next(AppError.badRequest('Investimento possui eventos vinculados. Arquive-o ou remova os eventos antes de excluir.'));
    }

    await prisma.investimento.update({ where: { id }, data: { deleted_at: new Date() } });

    logger.info({ msg: 'Investimento removido', userId, investimentoId: id });

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

async function handleListEventos(req, res, next) {
  const parsedQuery = EventoQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) return next(toValidationError(parsedQuery.error));

  const userId = req.user.sub;
  const { id } = req.params;
  const { page, perPage, tipo } = parsedQuery.data;

  try {
    const inv = await prisma.investimento.findFirst({ where: { id, usuario_id: userId, deleted_at: null } });
    if (!inv) return next(AppError.notFound('Investimento não encontrado.'));

    const where = { investimento_id: id, deleted_at: null };
    if (tipo) where.tipo = tipo;

    const [eventos, total] = await Promise.all([
      prisma.investimentoEvento.findMany({
        where,
        orderBy: [{ data: 'desc' }, { created_at: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.investimentoEvento.count({ where }),
    ]);

    return res.status(200).json({
      items: eventos.map(formatEvento),
      total,
      page,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return next(err);
  }
}

async function handleCreateEvento(req, res, next) {
  const parsed = CreateEventoSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  const userId = req.user.sub;
  const { id } = req.params;
  const { tipo, valor, data, descricao } = parsed.data;

  try {
    const inv = await prisma.investimento.findFirst({ where: { id, usuario_id: userId, deleted_at: null } });
    if (!inv) return next(AppError.notFound('Investimento não encontrado.'));

    // RF5 — Coerência temporal: se o investimento tiver data_inicio, o evento não pode ser anterior a ela.
    if (inv.data_inicio) {
      const dataEvento = new Date(data + 'T00:00:00.000Z');
      const dataInicio = new Date(new Date(inv.data_inicio).toISOString().substring(0, 10) + 'T00:00:00.000Z');
      if (dataEvento < dataInicio) {
        return next(new AppError('VALIDATION_ERROR', 'A data do evento não pode ser anterior à data de início do investimento.', 422));
      }
    }

    const ev = await prisma.investimentoEvento.create({
      data: {
        investimento_id: id,
        usuario_id: userId,
        tipo,
        valor,
        data: new Date(data + 'T00:00:00.000Z'),
        descricao: descricao ?? null,
      },
    });

    logger.info({ msg: 'Evento de investimento criado', userId, investimentoId: id, eventoId: ev.id });

    return res.status(201).json({ item: formatEvento(ev) });
  } catch (err) {
    return next(err);
  }
}

async function handleDeleteEvento(req, res, next) {
  const userId = req.user.sub;
  const { id, eventoId } = req.params;

  try {
    const ev = await prisma.investimentoEvento.findFirst({
      where: { id: eventoId, investimento_id: id, usuario_id: userId, deleted_at: null },
    });
    if (!ev) return next(AppError.notFound('Evento não encontrado.'));

    await prisma.investimentoEvento.update({ where: { id: eventoId }, data: { deleted_at: new Date() } });

    logger.info({ msg: 'Evento de investimento removido', userId, investimentoId: id, eventoId });

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

async function handleGetPosicao(req, res, next) {
  const userId = req.user.sub;
  const { id } = req.params;

  try {
    const inv = await prisma.investimento.findFirst({ where: { id, usuario_id: userId, deleted_at: null } });
    if (!inv) return next(AppError.notFound('Investimento não encontrado.'));

    const eventos = await prisma.investimentoEvento.findMany({
      where: { investimento_id: id, deleted_at: null },
    });

    const posicao = calcularPosicao(eventos);

    return res.status(200).json({ posicao });
  } catch (err) {
    return next(err);
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/investimentos/tipos', readLimiter, jwtAuthMiddleware, requireAtivo, handleListTipos);
router.get('/investimentos', readLimiter, jwtAuthMiddleware, requireAtivo, handleList);
router.post('/investimentos', writeLimiter, jwtAuthMiddleware, requireAtivo, handleCreate);
router.get('/investimentos/:id', readLimiter, jwtAuthMiddleware, requireAtivo, handleGet);
router.patch('/investimentos/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleUpdate);
router.delete('/investimentos/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleDelete);
router.get('/investimentos/:id/eventos', readLimiter, jwtAuthMiddleware, requireAtivo, handleListEventos);
router.post('/investimentos/:id/eventos', writeLimiter, jwtAuthMiddleware, requireAtivo, handleCreateEvento);
router.delete('/investimentos/:id/eventos/:eventoId', writeLimiter, jwtAuthMiddleware, requireAtivo, handleDeleteEvento);
router.get('/investimentos/:id/posicao', readLimiter, jwtAuthMiddleware, requireAtivo, handleGetPosicao);

export default router;
