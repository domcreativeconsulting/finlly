import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

const PERFIL_SELECT = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  whatsapp: true,
  avatar_url: true,
  timezone: true,
  moeda: true,
  role: true,
  status: true,
  email_verificado: true,
  created_at: true,
  updated_at: true,
};

/**
 * Retorna o perfil completo do usuário, incluindo campos de preferência.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getPerfil(userId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: PERFIL_SELECT,
  });

  if (!usuario) throw AppError.notFound('Usuário não encontrado');
  return usuario;
}

/**
 * Atualiza os dados de perfil do usuário autenticado.
 * Campos editáveis: nome, email, whatsapp, timezone, moeda
 * @param {string} userId
 * @param {{ nome?: string, email?: string, whatsapp?: string, timezone?: string, moeda?: string }} data
 * @returns {Promise<object>} usuario atualizado
 */
export async function updatePerfil(userId, data) {
  const exists = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!exists) throw AppError.notFound('Usuário não encontrado');

  if (data.email) {
    const conflict = await prisma.usuario.findFirst({
      where: { email: data.email, NOT: { id: userId } },
      select: { id: true },
    });
    if (conflict) throw AppError.conflict('Email já está em uso');
  }

  try {
    const usuario = await prisma.usuario.update({
      where: { id: userId },
      data,
      select: PERFIL_SELECT,
    });
    return usuario;
  } catch (err) {
    if (err.code === 'P2002') throw AppError.conflict('Email já está em uso');
    throw err;
  }
}
