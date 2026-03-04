import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import prisma from '../lib/prisma.js';
import { createDefaultCategoriesForUser } from './categoriaService.js';
import logger from '../logger.js';

const scryptAsync = promisify(scrypt);

/**
 * Hashes a plain-text password using scrypt.
 *
 * @param {string} password
 * @returns {Promise<string>} salt:derivedKey hex string
 */
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Registers a new user and creates their default financial categories
 * inside an atomic transaction.
 *
 * @param {{ nome: string, email: string, senha: string }} data
 * @returns {Promise<{ id: string, nome: string, email: string, created_at: Date, categorias_criadas: number }>}
 */
export async function registerUser(data) {
  const { nome, email, senha } = data;
  const senha_hash = await hashPassword(senha);

  return await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { nome, email, senha_hash },
      select: { id: true, nome: true, email: true, created_at: true },
    });

    const categoriasCriadas = await createDefaultCategoriesForUser(usuario.id, tx);

    logger.info({
      msg: 'Novo usuário registrado com categorias padrão',
      usuarioId: usuario.id,
      categoriasCriadas,
    });

    return { ...usuario, categorias_criadas: categoriasCriadas };
  });
}
