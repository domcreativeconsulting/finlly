import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

const VALID_ORDER_FIELDS = ['created_at', 'nome', 'valor_alvo', 'data_inicio', 'data_fim'];

function formatMeta(meta, movimentos = []) {
  const ativos = movimentos.filter((m) => !m.deleted_at);
  const valorAtual = ativos.reduce((sum, m) => sum + Number(m.valor), 0);
  const percentualConcluido = Math.min(
    Math.round((valorAtual / Number(meta.valor_alvo)) * 10000) / 100,
    100,
  );
  return {
    id: meta.id,
    nome: meta.nome,
    tipo: meta.tipo,
    valorAlvo: Number(meta.valor_alvo),
    valorAtual,
    percentualConcluido,
    valorRestante: Math.max(Number(meta.valor_alvo) - valorAtual, 0),
    status: meta.status,
    icone: meta.icone ?? null,
    cor: meta.cor ?? null,
    observacoes: meta.observacoes ?? null,
    dataInicio: String(meta.data_inicio).substring(0, 10),
    dataFim: meta.data_fim ? String(meta.data_fim).substring(0, 10) : null,
    totalMovimentos: ativos.length,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };
}

function formatMovimento(mov) {
  return {
    id: mov.id,
    metaId: mov.meta_id,
    valor: Number(mov.valor),
    data: String(mov.data).substring(0, 10),
    descricao: mov.descricao ?? null,
    movimentacaoId: mov.movimentacao_id ?? null,
    createdAt: mov.created_at,
    updatedAt: mov.updated_at,
  };
}

export async function listMetas(userId, filters = {}) {
  const {
    status,
    tipo,
    busca,
    page = 1,
    limit = 20,
    order_by = 'created_at',
    order_dir = 'desc',
  } = filters;

  const orderBy = VALID_ORDER_FIELDS.includes(order_by) ? order_by : 'created_at';
  const orderDir = order_dir === 'asc' ? 'asc' : 'desc';

  const where = { usuario_id: userId, deleted_at: null };
  if (status) where.status = status;
  if (tipo) where.tipo = tipo;
  if (busca) where.nome = { contains: busca, mode: 'insensitive' };

  const [rows, total] = await Promise.all([
    prisma.meta.findMany({
      where,
      include: {
        movimentos: { where: { deleted_at: null } },
      },
      orderBy: [{ [orderBy]: orderDir }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.meta.count({ where }),
  ]);

  return {
    items: rows.map((m) => formatMeta(m, m.movimentos)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getMeta(userId, metaId) {
  const meta = await prisma.meta.findFirst({
    where: { id: metaId, usuario_id: userId, deleted_at: null },
    include: {
      movimentos: {
        where: { deleted_at: null },
        orderBy: [{ data: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!meta) throw AppError.notFound('Meta não encontrada');

  return {
    item: {
      ...formatMeta(meta, meta.movimentos),
      movimentos: meta.movimentos.map(formatMovimento),
    },
  };
}

export async function createMeta(userId, data) {
  const { nome, valor_alvo, data_inicio, tipo, data_fim, status, icone, cor, observacoes } = data;

  const meta = await prisma.meta.create({
    data: {
      usuario_id: userId,
      nome,
      tipo,
      valor_alvo,
      data_inicio: new Date(data_inicio + 'T00:00:00.000Z'),
      data_fim: data_fim ? new Date(data_fim + 'T00:00:00.000Z') : null,
      status: status ?? 'ativa',
      icone: icone ?? null,
      cor: cor ?? null,
      observacoes: observacoes ?? null,
    },
  });

  return { item: formatMeta(meta, []) };
}

export async function updateMeta(userId, metaId, data) {
  const existing = await prisma.meta.findFirst({
    where: { id: metaId, usuario_id: userId, deleted_at: null },
  });
  if (!existing) throw AppError.notFound('Meta não encontrada');

  const updateData = { updated_at: new Date() };
  if (data.nome !== undefined) updateData.nome = data.nome;
  if (data.valor_alvo !== undefined) updateData.valor_alvo = data.valor_alvo;
  if (data.data_inicio !== undefined)
    updateData.data_inicio = new Date(data.data_inicio + 'T00:00:00.000Z');
  if (data.data_fim !== undefined)
    updateData.data_fim = data.data_fim ? new Date(data.data_fim + 'T00:00:00.000Z') : null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.icone !== undefined) updateData.icone = data.icone;
  if (data.cor !== undefined) updateData.cor = data.cor;
  if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;

  const updated = await prisma.meta.update({
    where: { id: metaId },
    data: updateData,
    include: { movimentos: { where: { deleted_at: null } } },
  });

  return { item: formatMeta(updated, updated.movimentos) };
}

export async function deleteMeta(userId, metaId) {
  const existing = await prisma.meta.findFirst({
    where: { id: metaId, usuario_id: userId, deleted_at: null },
  });
  if (!existing) throw AppError.notFound('Meta não encontrada');

  await prisma.meta.update({
    where: { id: metaId },
    data: { deleted_at: new Date() },
  });

  return { deleted: true };
}

export async function createMovimento(userId, metaId, data) {
  const meta = await prisma.meta.findFirst({
    where: { id: metaId, usuario_id: userId, deleted_at: null },
  });
  if (!meta) throw AppError.notFound('Meta não encontrada');

  const { valor, data: dataStr, descricao, movimentacao_id } = data;

  const mov = await prisma.metaMovimento.create({
    data: {
      meta_id: metaId,
      usuario_id: userId,
      valor,
      data: new Date(dataStr + 'T00:00:00.000Z'),
      descricao: descricao ?? null,
      movimentacao_id: movimentacao_id ?? null,
    },
  });

  return { item: formatMovimento(mov) };
}

export async function deleteMovimento(userId, metaId, movimentoId) {
  const meta = await prisma.meta.findFirst({
    where: { id: metaId, usuario_id: userId, deleted_at: null },
  });
  if (!meta) throw AppError.notFound('Meta não encontrada');

  const mov = await prisma.metaMovimento.findFirst({
    where: { id: movimentoId, meta_id: metaId, deleted_at: null },
  });
  if (!mov) throw AppError.notFound('Movimento não encontrado');

  await prisma.metaMovimento.update({
    where: { id: movimentoId },
    data: { deleted_at: new Date() },
  });

  return { deleted: true };
}

export async function getProgresso(userId, metaId) {
  const meta = await prisma.meta.findFirst({
    where: { id: metaId, usuario_id: userId, deleted_at: null },
    include: { movimentos: { where: { deleted_at: null } } },
  });
  if (!meta) throw AppError.notFound('Meta não encontrada');

  const valorAtual = meta.movimentos.reduce((sum, m) => sum + Number(m.valor), 0);
  const valorAlvo = Number(meta.valor_alvo);
  const percentualConcluido = Math.min(
    Math.round((valorAtual / valorAlvo) * 10000) / 100,
    100,
  );

  return {
    item: {
      id: meta.id,
      nome: meta.nome,
      tipo: meta.tipo,
      valorAlvo,
      valorAtual,
      percentualConcluido,
      valorRestante: Math.max(valorAlvo - valorAtual, 0),
      status: meta.status,
      totalMovimentos: meta.movimentos.length,
      dataInicio: String(meta.data_inicio).substring(0, 10),
      dataFim: meta.data_fim ? String(meta.data_fim).substring(0, 10) : null,
    },
  };
}
