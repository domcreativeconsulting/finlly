import bcrypt from 'bcryptjs';
import prisma from '../utils/database.js';
import { createDefaultCategories } from './categoriaService.js';

const BCRYPT_ROUNDS = 12;

/**
 * Registers a new user and creates their default categories atomically.
 * @param {{ nome: string, email: string, senha: string }} data
 * @returns {Promise<{ id: string, nome: string, email: string, created_at: Date, categorias_criadas: number }>}
 */
export async function registerUser({ nome, email, senha }) {
  const senha_hash = await bcrypt.hash(senha, BCRYPT_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { nome, email, senha_hash },
      select: { id: true, nome: true, email: true, created_at: true },
    });

    const categorias_criadas = await createDefaultCategories(usuario.id, tx);

    return { ...usuario, categorias_criadas };
  });

  return result;
}
