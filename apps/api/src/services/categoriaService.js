import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

/**
 * List categories for a user (own + system), with optional tipo filter and hierarchy.
 * @param {string} userId
 * @param {{ tipo?, busca?, include_sistema? }} filters
 */
export async function listCategorias(userId, filters = {}) {
  const { tipo, busca, include_sistema } = filters;

  const where = {
    deleted_at: null,
    OR: [
      { usuario_id: userId },
      ...(include_sistema !== false ? [{ is_sistema: true, usuario_id: null }] : []),
    ],
  };

  if (tipo) where.tipo = tipo;
  if (busca) where.nome = { contains: busca, mode: 'insensitive' };

  const categorias = await prisma.categoria.findMany({
    where,
    include: {
      filhos: {
        where: { deleted_at: null },
        select: { id: true, nome: true, tipo: true, icone: true, cor: true, is_sistema: true },
      },
    },
    orderBy: [{ nome: 'asc' }],
  });

  return categorias;
}

/**
 * Get a single category by ID (user-owned or system).
 * @param {string} id
 * @param {string} userId
 */
export async function getCategoria(id, userId) {
  const categoria = await prisma.categoria.findFirst({
    where: {
      id,
      deleted_at: null,
      OR: [{ usuario_id: userId }, { is_sistema: true, usuario_id: null }],
    },
    include: {
      filhos: {
        where: { deleted_at: null },
        select: { id: true, nome: true, tipo: true, icone: true, cor: true },
      },
    },
  });

  if (!categoria) throw AppError.notFound('Categoria não encontrada');
  return categoria;
}

/**
 * Create a new user-owned category.
 * @param {string} userId
 * @param {{ nome, tipo, icone?, cor?, pai_id? }} data
 */
export async function createCategoria(userId, data) {
  const { nome, tipo, icone, cor, pai_id } = data;

  if (pai_id) {
    const pai = await prisma.categoria.findFirst({
      where: {
        id: pai_id,
        deleted_at: null,
        OR: [{ usuario_id: userId }, { is_sistema: true, usuario_id: null }],
      },
    });
    if (!pai) throw AppError.notFound('Categoria pai não encontrada');
  }

  try {
    const categoria = await prisma.categoria.create({
      data: {
        usuario_id: userId,
        nome,
        tipo,
        icone: icone ?? null,
        cor: cor ?? null,
        pai_id: pai_id ?? null,
        is_sistema: false,
      },
    });
    return categoria;
  } catch (err) {
    if (err.code === 'P2002') {
      throw AppError.conflict(`Já existe uma categoria "${nome}" do tipo "${tipo}" para este usuário`);
    }
    throw err;
  }
}

/**
 * Copies system template categories (is_sistema=true, usuario_id=NULL)
 * to a specific user. Returns the number of categories created.
 * @param {string} userId
 * @param {object} [tx] - Prisma transaction client (defaults to singleton)
 * @returns {Promise<number>}
 */
export async function createDefaultCategories(userId, tx = prisma) {
  const templates = await tx.categoria.findMany({
    where: { is_sistema: true, usuario_id: null },
    select: { nome: true, tipo: true, icone: true, cor: true },
  });

  if (templates.length === 0) {
    return 0;
  }

  const result = await tx.categoria.createMany({
    data: templates.map((t) => ({
      nome: t.nome,
      tipo: t.tipo,
      icone: t.icone ?? undefined,
      cor: t.cor ?? undefined,
      usuario_id: userId,
      is_sistema: false,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * Updates a user-owned category. Rejects system categories and wrong-owner updates.
 * @param {string} id - Category ID
 * @param {string} userId - Authenticated user ID
 * @param {{ nome?: string, tipo?: string, icone?: string, cor?: string, pai_id?: string }} data
 * @returns {Promise<object>}
 */
export async function updateCategoria(id, userId, data) {
  const categoria = await prisma.categoria.findFirst({
    where: { id, deleted_at: null },
  });

  if (!categoria) {
    throw AppError.notFound('Categoria não encontrada');
  }

  if (categoria.is_sistema) {
    throw AppError.forbidden('Não é possível editar categorias do sistema');
  }

  if (categoria.usuario_id !== userId) {
    throw AppError.forbidden('Não é possível editar categoria de outro usuário');
  }

  try {
    return await prisma.categoria.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      const nomeFinal = data.nome ?? categoria.nome;
      const tipoFinal = data.tipo ?? categoria.tipo;
      throw AppError.conflict(`Já existe uma categoria "${nomeFinal}" do tipo "${tipoFinal}" para este usuário`);
    }
    throw err;
  }
}

/**
 * Soft-deletes a user-owned category. Rejects system categories and wrong-owner deletions.
 * @param {string} id - Category ID
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<object>}
 */
export async function deleteCategoria(id, userId) {
  const categoria = await prisma.categoria.findFirst({
    where: { id, deleted_at: null },
  });

  if (!categoria) {
    throw AppError.notFound('Categoria não encontrada');
  }

  if (categoria.is_sistema) {
    throw AppError.forbidden('Não é possível excluir categorias do sistema');
  }

  if (categoria.usuario_id !== userId) {
    throw AppError.forbidden('Não é possível excluir categoria de outro usuário');
  }

  const now = new Date();
  return prisma.categoria.update({
    where: { id },
    data: { deleted_at: now },
  });
}
