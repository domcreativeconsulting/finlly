import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

const SORT_FIELD_MAP = {
  date: 'data',
  amount: 'valor',
  description: 'descricao',
  createdAt: 'created_at',
};

const TYPE_MAP = {
  IN: 'entrada',
  OUT: 'saida',
};

/**
 * Get extrato (cash movement statement) for a user with filters, pagination and totals.
 * @param {string} userId
 * @param {{
 *   dateFrom?: string,
 *   dateTo?: string,
 *   accountId?: string,
 *   type?: 'IN' | 'OUT',
 *   originType?: 'ACCOUNTS_PAYABLE' | 'ACCOUNTS_RECEIVABLE' | 'MANUAL',
 *   q?: string,
 *   page?: number,
 *   perPage?: number,
 *   sortBy?: 'date' | 'amount' | 'description' | 'createdAt',
 *   sortOrder?: 'asc' | 'desc',
 * }} filters
 */
export async function getExtrato(userId, filters = {}) {
  const { dateFrom, dateTo, accountId, type, originType, q } = filters;
  const page = filters.page ?? 1;
  const perPage = Math.min(filters.perPage ?? 20, 100);
  const sortField = SORT_FIELD_MAP[filters.sortBy] ?? 'data';
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  // Validate accountId ownership
  if (accountId) {
    const conta = await prisma.conta.findFirst({
      where: { id: accountId, usuario_id: userId, deleted_at: null },
      select: { id: true },
    });
    if (!conta) throw AppError.notFound('Conta não encontrada');
  }

  // Build where clause
  const where = {
    usuario_id: userId,
    deleted_at: null,
  };

  if (accountId) where.conta_id = accountId;

  if (type) where.tipo = TYPE_MAP[type];

  if (originType === 'ACCOUNTS_PAYABLE') {
    where.conta_pagar_id = { not: null };
  } else if (originType === 'ACCOUNTS_RECEIVABLE') {
    where.conta_receber_id = { not: null };
  } else if (originType === 'MANUAL') {
    where.conta_pagar_id = null;
    where.conta_receber_id = null;
  }

  if (q) where.descricao = { contains: q, mode: 'insensitive' };

  if (dateFrom || dateTo) {
    where.data = {};
    if (dateFrom) where.data.gte = new Date(dateFrom + 'T00:00:00.000Z');
    if (dateTo) where.data.lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  const skip = (page - 1) * perPage;
  const orderBy = [{ [sortField]: sortOrder }, { id: 'desc' }];

  const [items, total, aggEntrada, aggSaida] = await Promise.all([
    prisma.movimentacaoCaixa.findMany({
      where,
      include: {
        conta: { select: { nome: true } },
      },
      orderBy,
      skip,
      take: perPage,
    }),
    prisma.movimentacaoCaixa.count({ where }),
    prisma.movimentacaoCaixa.aggregate({
      where: { ...where, tipo: 'entrada' },
      _sum: { valor: true },
    }),
    prisma.movimentacaoCaixa.aggregate({
      where: { ...where, tipo: 'saida' },
      _sum: { valor: true },
    }),
  ]);

  const totalIn = Number(aggEntrada._sum.valor ?? 0);
  const totalOut = Number(aggSaida._sum.valor ?? 0);

  return {
    items: items.map((m) => ({
      id: m.id,
      accountId: m.conta_id,
      accountName: m.conta?.nome ?? null,
      type: m.tipo === 'entrada' ? 'IN' : m.tipo === 'saida' ? 'OUT' : 'TRANSFER',
      amount: Number(m.valor),
      date: m.data.toISOString().split('T')[0],
      description: m.descricao,
      originType: m.conta_pagar_id ? 'ACCOUNTS_PAYABLE' : m.conta_receber_id ? 'ACCOUNTS_RECEIVABLE' : 'MANUAL',
      originId: m.conta_pagar_id ?? m.conta_receber_id ?? null,
      createdAt: m.created_at,
    })),
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
    totals: {
      totalIn,
      totalOut,
      balanceDelta: totalIn - totalOut,
    },
  };
}
