import { scryptSync, randomBytes } from 'crypto';
import prisma from '../utils/database.js';
import { createDefaultCategories } from './categoriaService.js';

/**
 * Hashes a plain-text password using scrypt with a random salt.
 * @param {string} password
 * @returns {string} salt:hash
 */
function hashPassword(password) {
  const salt = randomBytes(32).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Registers a new user and creates their default categories atomically.
 * @param {{ nome: string, email: string, senha: string }} data
 * @returns {Promise<{ id: string, nome: string, email: string, created_at: Date, categorias_criadas: number }>}
 */
export async function registerUser({ nome, email, senha }) {
  const senha_hash = hashPassword(senha);

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
