import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Buffer } from 'buffer';
import { createHash, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import prisma from '../utils/database.js';
import { getRedisClient } from '../utils/redisClient.js';
import { config } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { createDefaultCategories } from './categoriaService.js';
import logger from '../logger.js';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5; // Redis rate-limit: max attempts per window
const RATE_LIMIT_WINDOW_SECONDS = 900; // 15 min

/**
 * Progressive lockout levels: after N failed attempts, lock account for durationMs.
 * Applied in ascending order — the highest matching threshold wins.
 */
const LOCKOUT_LEVELS = [
  { attempts: 3, durationMs: 5 * 60 * 1000 },           // 5 minutes
  { attempts: 5, durationMs: 30 * 60 * 1000 },          // 30 minutes
  { attempts: 10, durationMs: 24 * 60 * 60 * 1000 },    // 24 hours
];

/**
 * Returns the lockout duration in ms for a given attempt count, or null if no lockout.
 * @param {number} attempts
 * @returns {number|null}
 */
function getLockoutDuration(attempts) {
  for (let i = LOCKOUT_LEVELS.length - 1; i >= 0; i--) {
    if (attempts >= LOCKOUT_LEVELS[i].attempts) {
      return LOCKOUT_LEVELS[i].durationMs;
    }
  }
  return null;
}

/**
 * Hashes a string using SHA-256 (for storing refresh token hash in DB).
 * @param {string} value
 * @returns {string}
 */
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generates an access JWT.
 * @param {{ id: string, email: string, role: string }} usuario
 * @returns {string}
 */
function generateAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, email: usuario.email, role: usuario.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN },
  );
}

/**
 * Generates a refresh JWT.
 * @param {string} usuarioId
 * @param {string} sessionId
 * @returns {string}
 */
function generateRefreshToken(usuarioId, sessionId) {
  return jwt.sign(
    { sub: usuarioId, sessionId },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN },
  );
}

/**
 * Converts JWT expiry string (e.g. "30d", "15m") to seconds.
 * @param {string} val
 * @returns {number}
 */
export function parseExpiresInSeconds(val) {
  const match = String(val || '').match(/^(\d+)([smhd]?)$/);
  if (!match) return 30 * 24 * 60 * 60; // default 30 days
  const n = parseInt(match[1], 10);
  const unit = match[2] || 's';
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (multipliers[unit] || 1);
}

/**
 * Verifies a scrypt-hashed password (legacy format: salt:hash).
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyScryptPassword(password, storedHash) {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const derivedBuf = Buffer.from(derivedKey, 'hex');
    if (hashBuf.length !== derivedBuf.length) return false;
    return timingSafeEqual(derivedBuf, hashBuf);
  } catch {
    return false;
  }
}

/**
 * Verifies a password against a stored hash (supports both bcrypt and legacy scrypt).
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, storedHash) {
  // bcrypt hashes start with $2b$ or $2a$
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }
  // Legacy scrypt format: salt:hash
  return verifyScryptPassword(password, storedHash);
}

/**
 * Checks and increments the Redis-backed rate limit for login attempts.
 * Silently passes if Redis is unavailable.
 * @param {string} email
 * @param {string} [ip]
 */
async function checkRateLimit(email, ip = 'unknown') {
  let redis;
  try {
    redis = await getRedisClient();
  } catch {
    return; // Redis unavailable — skip rate limiting gracefully
  }

  const emailNormalized = email.trim().toLowerCase();
  const key = `login:attempts:${sha256(emailNormalized)}:${ip}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  if (attempts > MAX_LOGIN_ATTEMPTS) {
    logger.warn({ msg: 'Rate limit atingido no login', emailHash: sha256(emailNormalized), attempts });
    throw AppError.tooManyRequests('Muitas tentativas. Tente novamente em 15 minutos.');
  }
}

/**
 * Resets the Redis rate limit counter for an email+ip after a successful login.
 * @param {string} email
 * @param {string} [ip]
 */
async function resetRateLimit(email, ip = 'unknown') {
  let redis;
  try {
    redis = await getRedisClient();
    const emailNormalized = email.trim().toLowerCase();
    await redis.del(`login:attempts:${sha256(emailNormalized)}:${ip}`);
  } catch {
    // ignore
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
 * Registers a new user (POST /auth/register).
 * @param {{ nome: string, email: string, senha: string }} data
 * @param {{ ip?: string, userAgent?: string }} [meta]
 * @returns {Promise<{ usuario_id: string, email: string, nome: string, message: string }>}
 */
export async function register({ nome, email, senha }, meta = {}) {
  const existingUser = await prisma.usuario.findUnique({ where: { email } });
  if (existingUser) {
    throw AppError.badRequest('Email já existe');
  }

  const senha_hash = await bcrypt.hash(senha, BCRYPT_ROUNDS);

  const usuario = await prisma.$transaction(async (tx) => {
    const created = await tx.usuario.create({
      data: { nome, email, senha_hash },
      select: { id: true, nome: true, email: true },
    });

    await createDefaultCategories(created.id, tx);

    await tx.usuarioEventoAuth.create({
      data: {
        usuario_id: created.id,
        tipo: 'cadastro',
        sucesso: true,
        ip_address: meta.ip || null,
        user_agent: meta.userAgent || null,
      },
    });

    return created;
  });

  return {
    usuario_id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    message: 'Cadastro realizado com sucesso. Verifique seu e-mail.',
  };
}

/**
 * Logs in a user and returns access + refresh tokens (POST /auth/login).
 * @param {{ email: string, senha: string, device_info?: string }} data
 * @param {{ ip?: string, userAgent?: string }} [meta]
 * @returns {Promise<{ accessToken: string, refreshToken: string, usuario: object }>}
 */
export async function login({ email, senha, device_info }, meta = {}) {
  await checkRateLimit(email, meta.ip || 'unknown');

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario) {
    await createAuthEvent({
      usuario_id: null,
      tipo: 'login',
      sucesso: false,
      erro_msg: 'Email não encontrado',
      ip_address: meta.ip || null,
      user_agent: meta.userAgent || null,
    });
    throw AppError.unauthorized('Credenciais inválidas');
  }

  // Check for temporary lockout
  if (usuario.bloqueado_ate && usuario.bloqueado_ate > new Date()) {
    throw AppError.locked('Conta bloqueada temporariamente. Tente novamente mais tarde.');
  }

  // Check account status
  if (usuario.status !== 'ativo') {
    throw AppError.forbidden('Usuário bloqueado');
  }

  const senhaValida = await verifyPassword(senha, usuario.senha_hash);

  if (!senhaValida) {
    const newAttempts = usuario.tentativas_login + 1;
    const lockDurationMs = getLockoutDuration(newAttempts);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        tentativas_login: newAttempts,
        ...(lockDurationMs !== null && {
          bloqueado_ate: new Date(Date.now() + lockDurationMs),
        }),
      },
    });

    await createAuthEvent({
      usuario_id: usuario.id,
      tipo: 'login',
      sucesso: false,
      erro_msg: 'Senha incorreta',
      ip_address: meta.ip || null,
      user_agent: meta.userAgent || null,
    });

    if (lockDurationMs !== null) {
      throw AppError.locked('Conta bloqueada após múltiplas tentativas falhas.');
    }
    throw AppError.unauthorized('Credenciais inválidas');
  }

  // Successful login: reset attempts
  await resetRateLimit(email, meta.ip || 'unknown');

  const refreshExpiresInSeconds = parseExpiresInSeconds(config.JWT_REFRESH_EXPIRES_IN);
  const dataExpiracao = new Date(Date.now() + refreshExpiresInSeconds * 1000);

  // Pre-generate a session ID so the refresh token and DB row are created atomically
  const sessaoId = randomUUID();
  const accessToken = generateAccessToken(usuario);
  const refreshToken = generateRefreshToken(usuario.id, sessaoId);
  const refreshTokenHash = sha256(refreshToken);

  await prisma.$transaction(async (tx) => {
    await tx.usuarioSessao.create({
      data: {
        id: sessaoId,
        usuario_id: usuario.id,
        refresh_token_hash: refreshTokenHash,
        device_info: device_info || meta.userAgent || null,
        ip_address: meta.ip || null,
        data_expiracao: dataExpiracao,
      },
    });
    await tx.usuario.update({
      where: { id: usuario.id },
      data: { tentativas_login: 0, bloqueado_ate: null },
    });
  });

  await createAuthEvent({
    usuario_id: usuario.id,
    tipo: 'login',
    sucesso: true,
    ip_address: meta.ip || null,
    user_agent: meta.userAgent || null,
  });

  return {
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      status: usuario.status,
    },
  };
}

/**
 * Refreshes the access token (POST /auth/refresh).
 * @param {string} refreshToken
 * @returns {Promise<{ accessToken: string }>}
 */
export async function refresh(refreshToken) {
  try {
    jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
  } catch {
    throw AppError.unauthorized('Refresh token inválido ou expirado');
  }

  // Validate the session by matching the token hash in the DB
  const tokenHash = sha256(refreshToken);

  const sessao = await prisma.usuarioSessao.findUnique({
    where: { refresh_token_hash: tokenHash },
    include: { usuario: true },
  });

  if (!sessao) throw AppError.unauthorized('Sessão não encontrada');
  if (sessao.data_revogacao) throw AppError.unauthorized('Sessão revogada');
  if (sessao.data_expiracao < new Date()) throw AppError.unauthorized('Sessão expirada');

  const usuario = sessao.usuario;
  if (usuario.status !== 'ativo') throw AppError.forbidden('Usuário bloqueado');

  const accessToken = generateAccessToken(usuario);
  return { accessToken };
}

/**
 * Logs out user session(s) (POST /auth/logout).
 * @param {string} userId - The authenticated user's ID.
 * @param {{ sessao_id?: string, todas?: boolean, sessionId?: string }} [options]
 * @param {{ ip?: string, userAgent?: string }} [meta]
 * @returns {Promise<{ message: string, sessoes_revogadas: number }>}
 */
export async function logout(userId, { sessao_id, todas, sessionId } = {}, meta = {}) {
  const agora = new Date();
  let sessoesRevogadas = 0;

  if (todas) {
    const result = await prisma.usuarioSessao.updateMany({
      where: { usuario_id: userId, data_revogacao: null },
      data: { data_revogacao: agora },
    });
    sessoesRevogadas = result.count;
  } else {
    const targetId = sessao_id || sessionId;
    if (!targetId) {
      throw AppError.badRequest('Sessão não identificada');
    }

    const sessao = await prisma.usuarioSessao.findFirst({
      where: { id: targetId, usuario_id: userId },
    });
    if (!sessao) throw AppError.notFound('Sessão não encontrada');

    await prisma.usuarioSessao.update({
      where: { id: targetId },
      data: { data_revogacao: agora },
    });
    sessoesRevogadas = 1;
  }

  await createAuthEvent({
    usuario_id: userId,
    tipo: 'logout',
    sucesso: true,
    ip_address: meta.ip || null,
    user_agent: meta.userAgent || null,
  });

  return { message: 'Logout realizado com sucesso', sessoes_revogadas: sessoesRevogadas };
}

/**
 * Returns the authenticated user's data (GET /auth/me).
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getMe(userId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      avatar_url: true,
      whatsapp: true,
      timezone: true,
      moeda: true,
      role: true,
      status: true,
      email_verificado: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!usuario) throw AppError.notFound('Usuário não encontrado');
  return usuario;
}
