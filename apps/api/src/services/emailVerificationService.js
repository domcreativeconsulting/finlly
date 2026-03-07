import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import prisma from '../utils/database.js';
import { getRedisClient } from '../utils/redisClient.js';
import { sha256 } from '../utils/cryptoUtils.js';
import { config } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { sendEmailVerification } from './emailService.js';
import { maskEmail } from './passwordRecoveryService.js';
import logger from '../logger.js';

/**
 * Checks and increments the Redis-backed rate limit for verify-email resend.
 * Silently passes if Redis is unavailable.
 * @param {string} email
 */
async function checkVerifyEmailRateLimit(email) {
  let redis;
  try {
    redis = await getRedisClient();
  } catch {
    return;
  }

  const key = `verify_email:${email}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, config.VERIFY_EMAIL_RATE_WINDOW);
  }
  if (attempts > config.VERIFY_EMAIL_RATE_LIMIT) {
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

/**
 * Generates an email verification token and saves its hash to the DB.
 * @param {string} usuarioId
 * @returns {Promise<string>} JWT token
 */
export async function generateEmailVerificationToken(usuarioId) {
  const verificationId = randomUUID();
  const token = jwt.sign(
    { sub: usuarioId, verificationId, tipo: 'email_verification' },
    config.JWT_SECRET,
    { expiresIn: config.EMAIL_VERIFICATION_EXPIRATION },
  );

  const tokenHash = sha256(token);
  const dataExpiracao = new Date(Date.now() + config.EMAIL_VERIFICATION_EXPIRATION * 1000);

  await prisma.usuarioVerificacaoEmail.create({
    data: {
      id: verificationId,
      usuario_id: usuarioId,
      token_hash: tokenHash,
      verificado: false,
      data_expiracao: dataExpiracao,
    },
  });

  return token;
}

// ============================================================
// Public API
// ============================================================

/**
 * Verifies the user's email using a verification token (POST /auth/verify-email).
 * @param {string} token
 * @param {{ ip?: string, userAgent?: string }} [meta]
 * @returns {Promise<{ message: string, usuario_id: string }>}
 */
export async function verifyEmail(token, meta = {}) {
  // 1. Validate JWT
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw AppError.badRequest('Token expirado');
    }
    throw AppError.badRequest('Token ausente ou inválido');
  }

  if (!payload.verificationId || payload.tipo !== 'email_verification') {
    throw AppError.badRequest('Token ausente ou inválido');
  }

  // 2. Find the user
  const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
  if (!usuario) {
    throw AppError.notFound('Usuário não encontrado');
  }

  if (usuario.email_verificado) {
    throw AppError.badRequest('E-mail já verificado');
  }

  // 3. Verify the token hash
  const tokenHash = sha256(token);
  const verificationRecord = await prisma.usuarioVerificacaoEmail.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!verificationRecord || verificationRecord.verificado) {
    throw AppError.badRequest('Token ausente ou inválido');
  }

  if (verificationRecord.data_expiracao < new Date()) {
    throw AppError.badRequest('Token expirado');
  }

  // 4. Mark email as verified
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: { email_verificado: true },
    });

    await tx.usuarioVerificacaoEmail.update({
      where: { id: verificationRecord.id },
      data: {
        verificado: true,
        verificado_em: new Date(),
      },
    });
  });

  await createAuthEvent({
    usuario_id: usuario.id,
    tipo: 'email_verificado',
    sucesso: true,
    ip_address: meta.ip || null,
    user_agent: meta.userAgent || null,
  });

  return { message: 'E-mail verificado com sucesso', usuario_id: usuario.id };
}

/**
 * Resends the email verification link (POST /auth/resend-verification-email).
 * @param {string} email
 * @param {{ ip?: string, userAgent?: string }} [meta]
 * @returns {Promise<{ message: string, email_masked: string }>}
 */
export async function resendVerificationEmail(email, meta = {}) {
  await checkVerifyEmailRateLimit(email);

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario) {
    // Return generic message — do not reveal whether user exists
    return { message: 'E-mail de verificação reenviado', email_masked: maskEmail(email) };
  }

  if (usuario.email_verificado) {
    throw AppError.badRequest('E-mail já verificado');
  }

  const token = await generateEmailVerificationToken(usuario.id);
  const verifyLink = `${config.APP_URL}/verify-email?token=${token}`;

  try {
    await sendEmailVerification({ to: email, verifyLink });
  } catch (err) {
    logger.error({ msg: 'Failed to send verification email', email, err: err.message });
  }

  await createAuthEvent({
    usuario_id: usuario.id,
    tipo: 'verify_email_reenviado',
    sucesso: true,
    ip_address: meta.ip || null,
    user_agent: meta.userAgent || null,
  });

  return { message: 'E-mail de verificação reenviado', email_masked: maskEmail(email) };
}
