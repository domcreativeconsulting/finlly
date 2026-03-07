import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import prisma from '../utils/database.js';
import { getRedisClient } from '../utils/redisClient.js';
import { sha256 } from '../utils/cryptoUtils.js';
import { config } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from './emailService.js';
import logger from '../logger.js';

const BCRYPT_ROUNDS = 12;

/**
 * Masks an email address for safe display (e.g. "jo***@example.com").
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

/**
 * Checks and increments the Redis-backed rate limit for forgot-password.
 * Silently passes if Redis is unavailable.
 * @param {string} email
 * @param {string} redisKey
 * @param {number} maxAttempts
 * @param {number} windowSeconds
 */
async function checkEmailRateLimit(email, redisKey, maxAttempts, windowSeconds) {
  let redis;
  try {
    redis = await getRedisClient();
  } catch {
    return; // Redis unavailable — skip rate limiting gracefully
  }

  const key = `${redisKey}:${email}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, windowSeconds);
  }
  if (attempts > maxAttempts) {
    throw AppError.tooManyRequests('Muitas tentativas. Tente novamente em 1 hora.');
  }
}

/**
 * Creates an auth audit event.
 * @param {object} data
 */
async function createAuthEvent(data) {
  await prisma.usuarioEventoAuth.create({ data });
}

// ============================================================
// Public API
// ============================================================

/**
 * Initiates the forgot-password flow (POST /auth/forgot-password).
 * @param {string} email
 * @param {{ ip?: string, userAgent?: string }} [meta]
 * @returns {Promise<{ message: string, email_masked: string }>}
 */
export async function forgotPassword(email, meta = {}) {
  await checkEmailRateLimit(
    email,
    'forgot_password',
    config.FORGOT_PASSWORD_RATE_LIMIT,
    config.FORGOT_PASSWORD_RATE_WINDOW,
  );

  const GENERIC_MESSAGE = 'Se esse e-mail estiver registrado, você receberá um link de recuperação em breve';

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario || usuario.status !== 'ativo') {
    // Return generic message — do not reveal whether user exists
    return { message: GENERIC_MESSAGE, email_masked: maskEmail(email) };
  }

  const resetId = randomUUID();
  const token = jwt.sign(
    { sub: usuario.id, resetId, tipo: 'password_reset' },
    config.JWT_SECRET,
    { expiresIn: config.PASSWORD_RESET_EXPIRATION },
  );

  const tokenHash = sha256(token);
  const dataExpiracao = new Date(Date.now() + config.PASSWORD_RESET_EXPIRATION * 1000);

  await prisma.usuarioResetSenha.create({
    data: {
      id: resetId,
      usuario_id: usuario.id,
      token_hash: tokenHash,
      utilizado: false,
      data_expiracao: dataExpiracao,
    },
  });

  const resetLink = `${config.APP_URL}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail({ to: email, resetLink });
  } catch (err) {
    logger.error({ msg: 'Failed to send password reset email', email, err: err.message });
  }

  await createAuthEvent({
    usuario_id: usuario.id,
    tipo: 'reset_senha_solicitado',
    sucesso: true,
    ip_address: meta.ip || null,
    user_agent: meta.userAgent || null,
  });

  return { message: GENERIC_MESSAGE, email_masked: maskEmail(email) };
}

/**
 * Resets the user password using the reset token (POST /auth/reset-password).
 * @param {{ token: string, nova_senha: string }} data
 * @param {{ ip?: string, userAgent?: string }} [meta]
 * @returns {Promise<{ message: string, usuario_id: string }>}
 */
export async function resetPassword({ token, nova_senha }, meta = {}) {
  // 1. Validate JWT signature and expiration
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw AppError.badRequest('Token expirado');
    }
    throw AppError.badRequest('Token ausente ou inválido');
  }

  if (!payload.resetId || payload.tipo !== 'password_reset') {
    throw AppError.badRequest('Token ausente ou inválido');
  }

  // 2. Find the reset record
  const resetRecord = await prisma.usuarioResetSenha.findUnique({
    where: { id: payload.resetId },
  });

  if (!resetRecord) {
    throw AppError.notFound('Token não encontrado');
  }

  if (resetRecord.utilizado) {
    throw AppError.badRequest('Token já foi utilizado');
  }

  if (resetRecord.data_expiracao < new Date()) {
    throw AppError.badRequest('Token expirado');
  }

  // 3. Verify token hash matches what we stored
  const tokenHash = sha256(token);
  if (tokenHash !== resetRecord.token_hash) {
    throw AppError.badRequest('Token ausente ou inválido');
  }

  // 4. Find the user
  const usuario = await prisma.usuario.findUnique({ where: { id: resetRecord.usuario_id } });
  if (!usuario) {
    throw AppError.notFound('Usuário não encontrado');
  }

  if (usuario.status !== 'ativo') {
    throw AppError.forbidden('Usuário bloqueado');
  }

  // 5. Hash the new password
  const senha_hash = await bcrypt.hash(nova_senha, BCRYPT_ROUNDS);

  // 6. Update user password and reset lockout state; mark token as used
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        senha_hash,
        ultima_senha_troca: new Date(),
        tentativas_login: 0,
        bloqueado_ate: null,
      },
    });

    await tx.usuarioResetSenha.update({
      where: { id: resetRecord.id },
      data: {
        utilizado: true,
        utilizado_em: new Date(),
      },
    });
  });

  await createAuthEvent({
    usuario_id: usuario.id,
    tipo: 'reset_senha_concluido',
    sucesso: true,
    ip_address: meta.ip || null,
    user_agent: meta.userAgent || null,
  });

  try {
    await sendPasswordChangedEmail({ to: usuario.email });
  } catch (err) {
    logger.error({ msg: 'Failed to send password changed email', userId: usuario.id, err: err.message });
  }

  return { message: 'Senha redefinida com sucesso', usuario_id: usuario.id };
}
