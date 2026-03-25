import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

const ALLOWED_SORT_FIELDS = new Set(['data', 'valor', 'descricao', 'created_at', 'tipo']);

/**
 * List movimentações for a user with optional filters and pagination.
 * @param {string} userId
 * @param {{
 *   tipo?, conta_id?, categoria_id?,
 *   data_de?, data_ate?, busca?,
 *   page?, limit?,
 *   cursor?,
 *   order_by?,
 *   order_dir?,
 * }} filters
 */
export async function listMovimentacoes(userId, filters = {}) {
  const { tipo, conta_id, categoria_id, data_de, data_ate, busca, cursor } = filters;
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const orderBy = ALLOWED_SORT_FIELDS.has(filters.order_by) ? filters.order_by : 'data';
  const orderDir = filters.order_dir === 'asc' ? 'asc' : 'desc';

  const where = {
    usuario_id: userId,
    deleted_at: null,
  };

  if (tipo) where.tipo = tipo;
  if (conta_id) where.conta_id = conta_id;
  if (categoria_id) where.categoria_id = categoria_id;
  if (busca) where.descricao = { contains: busca, mode: 'insensitive' };

  if (data_de || data_ate) {
    where.data = {};
    if (data_de) where.data.gte = new Date(data_de + 'T00:00:00.000Z');
    if (data_ate) where.data.lte = new Date(data_ate + 'T00:00:00.000Z');
  }

  const include = {
    categoria: { select: { nome: true, cor: true, icone: true } },
    conta: { select: { nome: true } },
    conta_destino: { select: { nome: true } },
  };

  // Cursor-based pagination
  if (cursor) {
    const [movimentacoes, total] = await Promise.all([
      prisma.movimentacaoCaixa.findMany({
        where,
        include,
        orderBy: [{ [orderBy]: orderDir }, { id: 'asc' }],
        take: limit + 1,
        cursor: { id: cursor },
        skip: 1,
      }),
      prisma.movimentacaoCaixa.count({ where }),
    ]);

    const hasMore = movimentacoes.length > limit;
    if (hasMore) movimentacoes.pop();
    const nextCursor = hasMore ? movimentacoes[movimentacoes.length - 1].id : null;

    return {
      data: movimentacoes.map((m) => ({ ...m, valor: Number(m.valor) })),
      total,
      page: null,
      totalPages: Math.ceil(total / limit),
      nextCursor,
      hasPreviousPage: true,
    };
  }

  // Offset-based pagination (default)
  const skip = (page - 1) * limit;

  const [movimentacoes, total] = await Promise.all([
    prisma.movimentacaoCaixa.findMany({
      where,
      include,
      orderBy: [{ [orderBy]: orderDir }, { id: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.movimentacaoCaixa.count({ where }),
  ]);

  const data = movimentacoes.map((m) => ({ ...m, valor: Number(m.valor) }));

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    nextCursor: data.length === limit ? data[data.length - 1].id : null,
  };
}

/**
 * Get a single movimentação by ID, scoped to userId.
 * @param {string} id
 * @param {string} userId
 */
export async function getMovimentacao(id, userId) {
  const movimentacao = await prisma.movimentacaoCaixa.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    include: {
      categoria: { select: { nome: true, cor: true, icone: true } },
      conta: { select: { nome: true } },
      conta_destino: { select: { nome: true } },
    },
  });

  if (!movimentacao) throw AppError.notFound('Movimentação não encontrada');

  return { ...movimentacao, valor: Number(movimentacao.valor) };
}

/**
 * Create a manual movimentação (entrada, saida or transferencia).
 * For transferencia, two movimentações are created atomically.
 * @param {string} userId
 * @param {{ conta_id, tipo, valor, descricao, data, categoria_id?, conta_destino_id?, observacoes? }} data
 */
export async function createMovimentacao(userId, data) {
  const { conta_id, tipo, valor, descricao, data: dataMovimentacao, categoria_id, conta_destino_id, observacoes } = data;

  const dataDate = new Date(dataMovimentacao + 'T00:00:00.000Z');

  if (tipo === 'transferencia') {
    if (!conta_destino_id) {
      throw AppError.badRequest('conta_destino_id é obrigatório para transferências');
    }
    if (conta_id === conta_destino_id) {
      throw AppError.badRequest('conta_id e conta_destino_id não podem ser iguais');
    }

    const [saida, entrada] = await prisma.$transaction(async (tx) => {
      const saidaMovimentacao = await tx.movimentacaoCaixa.create({
        data: {
          usuario_id: userId,
          conta_id,
          tipo: 'saida',
          valor,
          descricao,
          data: dataDate,
          categoria_id: categoria_id ?? null,
          conta_destino_id,
          observacoes: observacoes ?? null,
        },
        include: {
          categoria: { select: { nome: true, cor: true, icone: true } },
          conta: { select: { nome: true } },
          conta_destino: { select: { nome: true } },
        },
      });

      const entradaMovimentacao = await tx.movimentacaoCaixa.create({
        data: {
          usuario_id: userId,
          conta_id: conta_destino_id,
          tipo: 'entrada',
          valor,
          descricao,
          data: dataDate,
          categoria_id: categoria_id ?? null,
          conta_destino_id: conta_id,
          observacoes: observacoes ?? null,
        },
        include: {
          categoria: { select: { nome: true, cor: true, icone: true } },
          conta: { select: { nome: true } },
          conta_destino: { select: { nome: true } },
        },
      });

      return [saidaMovimentacao, entradaMovimentacao];
    });

    return {
      saida: { ...saida, valor: Number(saida.valor) },
      entrada: { ...entrada, valor: Number(entrada.valor) },
    };
  }

  // entrada or saida
  const movimentacao = await prisma.movimentacaoCaixa.create({
    data: {
      usuario_id: userId,
      conta_id,
      tipo,
      valor,
      descricao,
      data: dataDate,
      categoria_id: categoria_id ?? null,
      conta_destino_id: conta_destino_id ?? null,
      observacoes: observacoes ?? null,
    },
    include: {
      categoria: { select: { nome: true, cor: true, icone: true } },
      conta: { select: { nome: true } },
      conta_destino: { select: { nome: true } },
    },
  });

  return { ...movimentacao, valor: Number(movimentacao.valor) };
}

/**
 * Update a manual movimentação (only if origin is MANUAL, i.e. conta_pagar_id and conta_receber_id are null).
 * @param {string} id
 * @param {string} userId
 * @param {{ conta_id?, tipo?, valor?, descricao?, data?, categoria_id?, observacoes? }} data
 */
export async function updateMovimentacao(id, userId, data) {
  const existing = await prisma.movimentacaoCaixa.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    select: { id: true, conta_pagar_id: true, conta_receber_id: true },
  });

  if (!existing) throw AppError.notFound('Movimentação não encontrada');
  if (existing.conta_pagar_id !== null || existing.conta_receber_id !== null) {
    throw AppError.badRequest('Movimentações geradas por baixas não podem ser editadas manualmente');
  }

  const updateData = {};
  if (data.conta_id !== undefined) updateData.conta_id = data.conta_id;
  if (data.tipo !== undefined) updateData.tipo = data.tipo;
  if (data.valor !== undefined) updateData.valor = data.valor;
  if (data.descricao !== undefined) updateData.descricao = data.descricao;
  if (data.data !== undefined) updateData.data = new Date(data.data + 'T00:00:00.000Z');
  if (data.categoria_id !== undefined) updateData.categoria_id = data.categoria_id;
  if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;

  const movimentacao = await prisma.movimentacaoCaixa.update({
    where: { id },
    data: { ...updateData, updated_at: new Date() },
    include: {
      categoria: { select: { nome: true, cor: true, icone: true } },
      conta: { select: { nome: true } },
      conta_destino: { select: { nome: true } },
    },
  });

  return { ...movimentacao, valor: Number(movimentacao.valor) };
}

/**
 * Soft-delete a manual movimentação (only if origin is MANUAL).
 * @param {string} id
 * @param {string} userId
 */
export async function deleteMovimentacao(id, userId) {
  const existing = await prisma.movimentacaoCaixa.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    select: { id: true, conta_pagar_id: true, conta_receber_id: true },
  });

  if (!existing) throw AppError.notFound('Movimentação não encontrada');
  if (existing.conta_pagar_id !== null || existing.conta_receber_id !== null) {
    throw AppError.badRequest('Movimentações geradas por baixas não podem ser excluídas manualmente');
  }

  await prisma.movimentacaoCaixa.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}

/**
 * Calculate the balance of a specific conta, scoped to userId.
 * saldo = soma(entrada) - soma(saida); transferencias are excluded (already decomposed into entrada/saida).
 * @param {string} contaId
 * @param {string} userId
 */
export async function getSaldoConta(contaId, userId) {
  const conta = await prisma.conta.findFirst({
    where: { id: contaId, usuario_id: userId, deleted_at: null },
    select: { id: true, nome: true },
  });

  if (!conta) throw AppError.notFound('Conta não encontrada');

  const agg = await prisma.movimentacaoCaixa.groupBy({
    by: ['tipo'],
    where: {
      conta_id: contaId,
      usuario_id: userId,
      deleted_at: null,
      tipo: { in: ['entrada', 'saida'] },
    },
    _sum: { valor: true },
  });

  const entradas = Number(agg.find((a) => a.tipo === 'entrada')?._sum.valor ?? 0);
  const saidas = Number(agg.find((a) => a.tipo === 'saida')?._sum.valor ?? 0);
  const saldo = entradas - saidas;

  return { conta_id: contaId, nome: conta.nome, entradas, saidas, saldo };
}

/**
 * Calculate the consolidated balance across all contas with incluir_total = true for the user.
 * @param {string} userId
 */
export async function getSaldoConsolidado(userId) {
  const contas = await prisma.conta.findMany({
    where: { usuario_id: userId, incluir_total: true, deleted_at: null },
    select: { id: true, nome: true },
  });

  if (contas.length === 0) {
    return { saldo: 0, entradas: 0, saidas: 0, contas: [] };
  }

  const contaIds = contas.map((c) => c.id);

  const agg = await prisma.movimentacaoCaixa.groupBy({
    by: ['tipo'],
    where: {
      conta_id: { in: contaIds },
      usuario_id: userId,
      deleted_at: null,
      tipo: { in: ['entrada', 'saida'] },
    },
    _sum: { valor: true },
  });

  const entradas = Number(agg.find((a) => a.tipo === 'entrada')?._sum.valor ?? 0);
  const saidas = Number(agg.find((a) => a.tipo === 'saida')?._sum.valor ?? 0);
  const saldo = entradas - saidas;

  return { saldo, entradas, saidas, contas: contas.map((c) => c.id) };
}
