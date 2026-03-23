import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

/**
 * List contas a pagar for a user with optional filters and pagination.
 * @param {string} userId
 * @param {{ status?, categoria_id?, conta_id?, data_vencimento_de?, data_vencimento_ate?, page?, limit? }} filters
 */
export async function listContasPagar(userId, filters = {}) {
  const { status, categoria_id, conta_id, data_vencimento_de, data_vencimento_ate } = filters;
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where = {
    usuario_id: userId,
    deleted_at: null,
  };

  if (status) where.status = status;
  if (categoria_id) where.categoria_id = categoria_id;
  if (conta_id) where.conta_id = conta_id;

  if (data_vencimento_de || data_vencimento_ate) {
    where.data_vencimento = {};
    if (data_vencimento_de) where.data_vencimento.gte = new Date(data_vencimento_de + 'T00:00:00.000Z');
    if (data_vencimento_ate) where.data_vencimento.lte = new Date(data_vencimento_ate + 'T00:00:00.000Z');
  }

  const [contas, total] = await Promise.all([
    prisma.contaPagar.findMany({
      where,
      include: {
        categoria: { select: { nome: true, cor: true, icone: true } },
        conta: { select: { nome: true } },
      },
      orderBy: [{ data_vencimento: 'asc' }, { created_at: 'desc' }],
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

/**
 * Create a new conta a pagar.
 * @param {string} userId
 * @param {{ descricao, valor, data_vencimento, categoria_id?, conta_id?, observacoes?, recorrente? }} data
 */
export async function createContaPagar(userId, data) {
  const { descricao, valor, data_vencimento, categoria_id, conta_id, observacoes, recorrente } = data;

  const conta = await prisma.contaPagar.create({
    data: {
      usuario_id: userId,
      descricao,
      valor,
      data_vencimento: new Date(data_vencimento + 'T00:00:00.000Z'),
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
