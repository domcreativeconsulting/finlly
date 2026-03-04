import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

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

  return prisma.categoria.update({
    where: { id },
    data: { ...data, updated_at: new Date() },
  });
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
