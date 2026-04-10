import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';
import { registrarEvento } from './auditoria.service.js';

/**
 * List all contas for a user with computed saldo.
 * Saldo = sum of entradas - sum of saidas from movimentacoes_caixa (not deleted).
 * @param {string} userId
 * @param {{ status? }} filters
 */
export async function listContas(userId, filters = {}) {
  const { status } = filters;

  const where = { usuario_id: userId, deleted_at: null };
  if (status) where.status = status;

  const contas = await prisma.conta.findMany({
    where,
    include: {
      instituicao: { select: { nome: true } },
    },
    orderBy: [{ nome: 'asc' }],
  });

  const contasComSaldo = await Promise.all(
    contas.map(async (conta) => {
      const agg = await prisma.movimentacaoCaixa.groupBy({
        by: ['tipo'],
        where: { conta_id: conta.id, deleted_at: null },
        _sum: { valor: true },
      });
      const entradas = Number(agg.find((a) => a.tipo === 'entrada')?._sum.valor ?? 0);
      const saidas = Number(agg.find((a) => a.tipo === 'saida')?._sum.valor ?? 0);
      return { ...conta, saldo: entradas - saidas };
    })
  );

  return contasComSaldo;
}

/**
 * Get a single conta by ID, scoped to userId, with saldo.
 * @param {string} id
 * @param {string} userId
 */
export async function getConta(id, userId) {
  const conta = await prisma.conta.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
    include: { instituicao: { select: { nome: true } } },
  });

  if (!conta) throw AppError.notFound('Conta não encontrada');

  const agg = await prisma.movimentacaoCaixa.groupBy({
    by: ['tipo'],
    where: { conta_id: conta.id, deleted_at: null },
    _sum: { valor: true },
  });
  const entradas = Number(agg.find((a) => a.tipo === 'entrada')?._sum.valor ?? 0);
  const saidas = Number(agg.find((a) => a.tipo === 'saida')?._sum.valor ?? 0);

  return { ...conta, saldo: entradas - saidas };
}

/**
 * Create a new conta for a user.
 * @param {string} userId
 * @param {{ nome, tipo, cor?, icone?, incluir_total?, instituicao_financeira_id? }} data
 */
export async function createConta(userId, data) {
  const { nome, tipo, cor, icone, incluir_total, instituicao_financeira_id } = data;

  const conta = await prisma.conta.create({
    data: {
      usuario_id: userId,
      nome,
      tipo,
      cor: cor ?? null,
      icone: icone ?? null,
      incluir_total: incluir_total ?? true,
      instituicao_financeira_id: instituicao_financeira_id ?? null,
      status: 'ativa',
    },
    include: { instituicao: { select: { nome: true } } },
  });

  return { ...conta, saldo: 0 };
}

/**
 * Update a conta (only user-owned, not deleted).
 * @param {string} id
 * @param {string} userId
 * @param {{ nome?, tipo?, cor?, icone?, incluir_total?, status? }} data
 */
export async function updateConta(id, userId, data) {
  const existing = await prisma.conta.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
  });

  if (!existing) throw AppError.notFound('Conta não encontrada');

  const updateData = {};
  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.tipo !== undefined) updateData.tipo = data.tipo;
  if (data.cor !== undefined) updateData.cor = data.cor;
  if (data.icone !== undefined) updateData.icone = data.icone;
  if (data.incluir_total !== undefined) updateData.incluir_total = data.incluir_total;
  if (data.status !== undefined) updateData.status = data.status;

  const conta = await prisma.conta.update({
    where: { id },
    data: { ...updateData, updated_at: new Date() },
    include: { instituicao: { select: { nome: true } } },
  });

  const agg = await prisma.movimentacaoCaixa.groupBy({
    by: ['tipo'],
    where: { conta_id: conta.id, deleted_at: null },
    _sum: { valor: true },
  });
  const entradas = Number(agg.find((a) => a.tipo === 'entrada')?._sum.valor ?? 0);
  const saidas = Number(agg.find((a) => a.tipo === 'saida')?._sum.valor ?? 0);

  return { ...conta, saldo: entradas - saidas };
}

/**
 * Soft-delete a conta (only if it has no movimentacoes not deleted).
 * @param {string} id
 * @param {string} userId
 */
export async function deleteConta(id, userId) {
  const existing = await prisma.conta.findFirst({
    where: { id, usuario_id: userId, deleted_at: null },
  });

  if (!existing) throw AppError.notFound('Conta não encontrada');

  const movCount = await prisma.movimentacaoCaixa.count({
    where: { conta_id: id, deleted_at: null },
  });

  if (movCount > 0) {
    throw AppError.badRequest('Não é possível excluir uma conta com movimentações. Inative-a em vez disso.');
  }

  await prisma.conta.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  registrarEvento({
    usuarioId: userId,
    actorType: 'USER',
    eventType: 'delete',
    eventAction: 'conta_excluida',
    entityType: 'conta',
    entityId: id,
    sucesso: true,
  });
}
