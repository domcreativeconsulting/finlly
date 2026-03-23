import { randomUUID } from 'crypto';
import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

const ALLOWED_SORT_FIELDS = new Set(['data_vencimento', 'valor', 'descricao', 'created_at', 'status']);

/**
 * List contas a pagar for a user with optional filters and pagination.
 * @param {string} userId
 * @param {{
 *   status?, categoria_id?, conta_id?,
 *   data_vencimento_de?, data_vencimento_ate?, busca?,
 *   page?, limit?,
 *   cursor?,       // UUID do último item → ativa cursor-based pagination
 *   order_by?,     // campo de ordenação (default: 'data_vencimento')
 *   order_dir?,    // 'asc' | 'desc' (default: 'asc')
 * }} filters
 */
export async function listContasPagar(userId, filters = {}) {
  const { status, categoria_id, conta_id, data_vencimento_de, data_vencimento_ate, busca, cursor } = filters;
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const orderBy = ALLOWED_SORT_FIELDS.has(filters.order_by) ? filters.order_by : 'data_vencimento';
  const orderDir = filters.order_dir === 'desc' ? 'desc' : 'asc';

  const where = {
    usuario_id: userId,
    deleted_at: null,
  };

  if (status) where.status = status;
  if (categoria_id) where.categoria_id = categoria_id;
  if (conta_id) where.conta_id = conta_id;
  if (busca) where.descricao = { contains: busca, mode: 'insensitive' };

  if (data_vencimento_de || data_vencimento_ate) {
    where.data_vencimento = {};
    if (data_vencimento_de) where.data_vencimento.gte = new Date(data_vencimento_de + 'T00:00:00.000Z');
    if (data_vencimento_ate) where.data_vencimento.lte = new Date(data_vencimento_ate + 'T00:00:00.000Z');
  }

  // Cursor-based pagination
  if (cursor) {
    const [contas, total] = await Promise.all([
      prisma.contaPagar.findMany({
        where,
        include: {
          categoria: { select: { nome: true, cor: true, icone: true } },
          conta: { select: { nome: true } },
        },
        orderBy: [{ [orderBy]: orderDir }, { id: 'asc' }],
        take: limit + 1,
        cursor: { id: cursor },
        skip: 1,
      }),
      prisma.contaPagar.count({ where }),
    ]);

    const hasMore = contas.length > limit;
    if (hasMore) contas.pop();
    const nextCursor = hasMore ? contas[contas.length - 1].id : null;

    return {
      data: contas.map((c) => ({ ...c, valor: Number(c.valor) })),
      total,
      page: null,
      totalPages: Math.ceil(total / limit),
      nextCursor,
      hasPreviousPage: true,
    };
  }

  // Offset-based pagination (default)
  const skip = (page - 1) * limit;

  const [contas, total] = await Promise.all([
    prisma.contaPagar.findMany({
      where,
      include: {
        categoria: { select: { nome: true, cor: true, icone: true } },
        conta: { select: { nome: true } },
      },
      orderBy: [{ [orderBy]: orderDir }, { id: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.contaPagar.count({ where }),
  ]);

  const data = contas.map((c) => ({ ...c, valor: Number(c.valor) }));

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    nextCursor: data.length === limit ? data[data.length - 1].id : null,
  };
}

/**
 * Get a single conta a pagar by ID, scoped to userId.
 * @param {string} id
 * @param {string} userId
 */
export async function getContaPagar(id, userId) {
  const conta = await prisma.contaPagar.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    include: {
      categoria: { select: { nome: true, cor: true, icone: true } },
      conta: { select: { nome: true } },
    },
  });

  if (!conta) throw AppError.notFound('Conta a pagar não encontrada');

  return { ...conta, valor: Number(conta.valor) };
}

/** @type {Record<string, (d: Date, n: number) => Date>} */
const RECORRENCIA_OFFSET = {
  diario: (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; },
  semanal: (d, n) => { const r = new Date(d); r.setDate(r.getDate() + 7 * n); return r; },
  quinzenal: (d, n) => { const r = new Date(d); r.setDate(r.getDate() + 15 * n); return r; },
  mensal: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; },
  bimestral: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + 2 * n); return r; },
  trimestral: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + 3 * n); return r; },
  semestral: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + 6 * n); return r; },
  anual: (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + 12 * n); return r; },
};

/**
 * Create a new conta a pagar. Supports parcelamento when total_parcelas is provided.
 * @param {string} userId
 * @param {{ descricao, valor, data_vencimento, categoria_id?, conta_id?, observacoes?, recorrente?, total_parcelas?, recorrencia? }} data
 */
export async function createContaPagar(userId, data) {
  const { descricao, valor, data_vencimento, categoria_id, conta_id, observacoes, recorrente, total_parcelas, recorrencia } = data;
  const baseDate = new Date(data_vencimento + 'T00:00:00.000Z');

  if (total_parcelas) {
    const grupo_recorrencia_id = randomUUID();
    const offsetFn = RECORRENCIA_OFFSET[recorrencia ?? 'mensal'];
    const parcelas = Array.from({ length: total_parcelas }, (_, i) => ({
      usuario_id: userId,
      descricao,
      valor,
      data_vencimento: offsetFn(baseDate, i),
      categoria_id: categoria_id ?? null,
      conta_id: conta_id ?? null,
      observacoes: observacoes ?? null,
      recorrente: recorrente ?? true,
      recorrencia: recorrencia ?? 'mensal',
      parcela_atual: i + 1,
      total_parcelas,
      grupo_recorrencia_id,
      status: 'pendente',
    }));

    await prisma.contaPagar.createMany({ data: parcelas });

    const primeira = await prisma.contaPagar.findFirst({
      where: { grupo_recorrencia_id, usuario_id: userId, parcela_atual: 1 },
      include: {
        categoria: { select: { nome: true, cor: true, icone: true } },
        conta: { select: { nome: true } },
      },
    });

    return {
      parcelas: total_parcelas,
      grupo_recorrencia_id,
      data: [{ ...primeira, valor: Number(primeira.valor) }],
    };
  }

  const conta = await prisma.contaPagar.create({
    data: {
      usuario_id: userId,
      descricao,
      valor,
      data_vencimento: baseDate,
      categoria_id: categoria_id ?? null,
      conta_id: conta_id ?? null,
      observacoes: observacoes ?? null,
      recorrente: recorrente ?? false,
      status: 'pendente',
    },
    include: {
      categoria: { select: { nome: true, cor: true, icone: true } },
      conta: { select: { nome: true } },
    },
  });

  return { ...conta, valor: Number(conta.valor) };
}

/**
 * Update a conta a pagar (only if not 'pago').
 * @param {string} id
 * @param {string} userId
 * @param {{ descricao?, valor?, data_vencimento?, categoria_id?, conta_id?, observacoes? }} data
 */
export async function updateContaPagar(id, userId, data) {
  const existing = await prisma.contaPagar.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    select: { id: true, status: true },
  });

  if (!existing) throw AppError.notFound('Conta a pagar não encontrada');
  if (existing.status === 'pago') throw AppError.badRequest('Não é possível editar uma conta já paga');

  const updateData = {};
  if (data.descricao !== undefined) updateData.descricao = data.descricao;
  if (data.valor !== undefined) updateData.valor = data.valor;
  if (data.data_vencimento !== undefined) updateData.data_vencimento = new Date(data.data_vencimento + 'T00:00:00.000Z');
  if (data.categoria_id !== undefined) updateData.categoria_id = data.categoria_id;
  if (data.conta_id !== undefined) updateData.conta_id = data.conta_id;
  if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;

  const conta = await prisma.contaPagar.update({
    where: { id },
    data: { ...updateData, updated_at: new Date() },
    include: {
      categoria: { select: { nome: true, cor: true, icone: true } },
      conta: { select: { nome: true } },
    },
  });

  return { ...conta, valor: Number(conta.valor) };
}

/**
 * Soft-delete a conta a pagar (only if not 'pago').
 * @param {string} id
 * @param {string} userId
 */
export async function deleteContaPagar(id, userId) {
  const existing = await prisma.contaPagar.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    select: { id: true, status: true },
  });

  if (!existing) throw AppError.notFound('Conta a pagar não encontrada');
  if (existing.status === 'pago') throw AppError.badRequest('Não é possível excluir uma conta já paga');

  await prisma.contaPagar.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}

/**
 * Register payment for a conta a pagar.
 * Atomically updates the status and creates a MovimentacaoCaixa (saida) when conta_id is available.
 * @param {string} id
 * @param {string} userId
 * @param {{ data_pagamento?: string, conta_id?: string, observacoes?: string }} options
 */
export async function pagarContaPagar(id, userId, { data_pagamento, conta_id: contaIdOverride, observacoes } = {}) {
  const existing = await prisma.contaPagar.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    select: { id: true, status: true, valor: true, conta_id: true, categoria_id: true, descricao: true },
  });

  if (!existing) throw AppError.notFound('Conta a pagar não encontrada');
  if (existing.status === 'pago') throw AppError.badRequest('Conta a pagar já está paga');

  const dataPagamento = data_pagamento ? new Date(data_pagamento + 'T00:00:00.000Z') : new Date();
  const contaIdParaMovimentacao = contaIdOverride ?? existing.conta_id;

  const [conta] = await prisma.$transaction(async (tx) => {
    const contaAtualizada = await tx.contaPagar.update({
      where: { id },
      data: {
        status: 'pago',
        data_pagamento: dataPagamento,
        updated_at: new Date(),
      },
      include: {
        categoria: { select: { nome: true, cor: true, icone: true } },
        conta: { select: { nome: true } },
      },
    });

    let movimentacao = null;
    if (contaIdParaMovimentacao) {
      movimentacao = await tx.movimentacaoCaixa.create({
        data: {
          usuario_id: userId,
          conta_id: contaIdParaMovimentacao,
          tipo: 'saida',
          valor: existing.valor,
          descricao: `Pagamento: ${existing.descricao}`,
          data: dataPagamento,
          categoria_id: existing.categoria_id ?? null,
          conta_pagar_id: id,
          observacoes: observacoes ?? null,
        },
      });
    }

    return [contaAtualizada, movimentacao];
  });

  return { ...conta, valor: Number(conta.valor) };
}

/**
 * Cancel a conta a pagar.
 * @param {string} id
 * @param {string} userId
 */
export async function cancelarContaPagar(id, userId) {
  const existing = await prisma.contaPagar.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    select: { id: true, status: true },
  });

  if (!existing) throw AppError.notFound('Conta a pagar não encontrada');
  if (existing.status === 'pago') throw AppError.badRequest('Não é possível cancelar uma conta já paga');
  if (existing.status === 'cancelado') throw AppError.badRequest('Conta a pagar já está cancelada');

  const conta = await prisma.contaPagar.update({
    where: { id },
    data: { status: 'cancelado', updated_at: new Date() },
    include: {
      categoria: { select: { nome: true, cor: true, icone: true } },
      conta: { select: { nome: true } },
    },
  });

  return { ...conta, valor: Number(conta.valor) };
}
