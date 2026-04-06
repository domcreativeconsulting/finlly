import prisma from '../utils/database.js';

/**
 * Parses filter date strings into Date objects with proper day boundaries.
 * @param {string|undefined} dataInicio
 * @param {string|undefined} dataFim
 * @returns {{ inicio: Date, fim: Date }}
 */
function parseDateRange(dataInicio, dataFim) {
  return {
    inicio: new Date(dataInicio + 'T00:00:00.000Z'),
    fim: new Date(dataFim + 'T23:59:59.999Z'),
  };
}

/**
 * Returns KPIs for the given period.
 * @param {string} usuarioId
 * @param {{ dataInicio: string, dataFim: string }} params
 */
export async function getKPIs(usuarioId, { dataInicio, dataFim }) {
  const { inicio, fim } = parseDateRange(dataInicio, dataFim);

  const [entradasAgg, saidasAgg, saldoContasAgg, contasPagarAgg, contasReceberAgg] =
    await Promise.all([
      // Total entradas no período
      prisma.movimentacaoCaixa.aggregate({
        where: {
          usuario_id: usuarioId,
          tipo: 'entrada',
          data: { gte: inicio, lte: fim },
          deleted_at: null,
        },
        _sum: { valor: true },
      }),

      // Total saídas no período
      prisma.movimentacaoCaixa.aggregate({
        where: {
          usuario_id: usuarioId,
          tipo: 'saida',
          data: { gte: inicio, lte: fim },
          deleted_at: null,
        },
        _sum: { valor: true },
      }),

      // Saldo atual: contas com incluir_total = true
      prisma.movimentacaoCaixa.groupBy({
        by: ['tipo'],
        where: {
          usuario_id: usuarioId,
          deleted_at: null,
          conta: { incluir_total: true, deleted_at: null },
        },
        _sum: { valor: true },
      }),

      // Contas a pagar pendentes
      prisma.contaPagar.aggregate({
        where: {
          usuario_id: usuarioId,
          status: 'pendente',
          deleted_at: null,
        },
        _sum: { valor: true },
      }),

      // Contas a receber pendentes
      prisma.contaReceber.aggregate({
        where: {
          usuario_id: usuarioId,
          status: 'pendente',
          deleted_at: null,
        },
        _sum: { valor: true },
      }),
    ]);

  const total_entradas = Number(entradasAgg._sum.valor ?? 0);
  const total_saidas = Number(saidasAgg._sum.valor ?? 0);
  const resultado = total_entradas - total_saidas;

  // Saldo atual: soma entradas - soma saídas das contas com incluir_total
  let saldoEntradas = 0;
  let saldoSaidas = 0;
  for (const row of saldoContasAgg) {
    if (row.tipo === 'entrada') saldoEntradas = Number(row._sum.valor ?? 0);
    if (row.tipo === 'saida') saldoSaidas = Number(row._sum.valor ?? 0);
  }
  const saldo_atual = saldoEntradas - saldoSaidas;

  return {
    total_entradas,
    total_saidas,
    resultado,
    saldo_atual,
    contas_pagar_pendente: Number(contasPagarAgg._sum.valor ?? 0),
    contas_receber_pendente: Number(contasReceberAgg._sum.valor ?? 0),
  };
}

/**
 * Returns monthly evolution for the last N months.
 * @param {string} usuarioId
 * @param {number} meses
 */
export async function getEvolucaoMensal(usuarioId, meses = 6) {
  const rows = await prisma.$queryRaw`
    SELECT
      TO_CHAR(DATE_TRUNC('month', data), 'YYYY-MM') AS mes,
      SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) AS entradas,
      SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) AS saidas
    FROM movimentacoes_caixa
    WHERE
      usuario_id = ${usuarioId}::uuid
      AND deleted_at IS NULL
      AND data >= DATE_TRUNC('month', NOW()) - (${meses - 1} * INTERVAL '1 month')
    GROUP BY DATE_TRUNC('month', data)
    ORDER BY DATE_TRUNC('month', data) ASC
  `;

  return rows.map((r) => ({
    mes: r.mes,
    entradas: Number(r.entradas ?? 0),
    saidas: Number(r.saidas ?? 0),
    resultado: Number(r.entradas ?? 0) - Number(r.saidas ?? 0),
  }));
}

/**
 * Returns top categories by spending in the period.
 * @param {string} usuarioId
 * @param {{ dataInicio: string, dataFim: string, tipo?: string, limit?: number }} params
 */
export async function getTopCategorias(usuarioId, { dataInicio, dataFim, tipo = 'saida', limit = 10 }) {
  const { inicio, fim } = parseDateRange(dataInicio, dataFim);

  const where = {
    usuario_id: usuarioId,
    deleted_at: null,
    data: { gte: inicio, lte: fim },
    categoria_id: { not: null },
  };
  if (tipo) where.tipo = tipo;

  const grupos = await prisma.movimentacaoCaixa.groupBy({
    by: ['categoria_id'],
    where,
    _sum: { valor: true },
    orderBy: { _sum: { valor: 'desc' } },
    take: limit,
  });

  if (grupos.length === 0) return [];

  const categoriaIds = grupos.map((g) => g.categoria_id);
  const categorias = await prisma.categoria.findMany({
    where: { id: { in: categoriaIds }, usuario_id: usuarioId, deleted_at: null },
    select: { id: true, nome: true },
  });

  const catMap = Object.fromEntries(categorias.map((c) => [c.id, c.nome]));

  return grupos.map((g) => ({
    categoria_id: g.categoria_id,
    categoria_nome: catMap[g.categoria_id] ?? 'Sem categoria',
    total: Number(g._sum.valor ?? 0),
  }));
}

/**
 * Returns balance per account for the user.
 * @param {string} usuarioId
 */
export async function getSaldoPorConta(usuarioId) {
  const contas = await prisma.conta.findMany({
    where: { usuario_id: usuarioId, status: 'ativa', deleted_at: null },
    select: { id: true, nome: true, tipo: true },
    orderBy: { nome: 'asc' },
  });

  const result = await Promise.all(
    contas.map(async (conta) => {
      const agg = await prisma.movimentacaoCaixa.groupBy({
        by: ['tipo'],
        where: { conta_id: conta.id, deleted_at: null },
        _sum: { valor: true },
      });

      let entradas = 0;
      let saidas = 0;
      for (const row of agg) {
        if (row.tipo === 'entrada') entradas = Number(row._sum.valor ?? 0);
        if (row.tipo === 'saida') saidas = Number(row._sum.valor ?? 0);
      }

      return {
        id: conta.id,
        nome: conta.nome,
        tipo: conta.tipo,
        saldo: entradas - saidas,
      };
    }),
  );

  return result;
}

/**
 * Returns paginated report of movimentacoes_caixa with optional filters.
 * @param {string} usuarioId
 * @param {{ dataInicio?, dataFim?, categoriaId?, contaId?, tipo?, page?, limit? }} params
 */
export async function getRelatorio(
  usuarioId,
  { dataInicio, dataFim, categoriaId, contaId, tipo, page = 1, limit = 50 },
) {
  const where = { usuario_id: usuarioId, deleted_at: null };

  if (tipo) where.tipo = tipo;
  if (categoriaId) where.categoria_id = categoriaId;
  if (contaId) where.conta_id = contaId;

  if (dataInicio || dataFim) {
    where.data = {};
    if (dataInicio) where.data.gte = parseDateRange(dataInicio, dataInicio).inicio;
    if (dataFim) where.data.lte = parseDateRange(dataFim, dataFim).fim;
  }

  const safeLimit = Math.min(Number(limit) || 50, 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [data, total] = await Promise.all([
    prisma.movimentacaoCaixa.findMany({
      where,
      include: {
        categoria: { select: { nome: true } },
        conta: { select: { nome: true } },
      },
      orderBy: { data: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.movimentacaoCaixa.count({ where }),
  ]);

  return {
    data: data.map((m) => ({ ...m, valor: Number(m.valor) })),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
}
