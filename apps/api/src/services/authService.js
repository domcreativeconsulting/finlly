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
import { registrarEvento } from './auditoria.service.js';
import { generateEmailVerificationToken } from './emailVerificationService.js';
import { sendEmailVerification } from './emailService.js';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 900;

const STATUSES_BLOQUEIAM_LOGIN = ['suspenso_seguranca'];

const LOCKOUT_LEVELS = [
  { attempts: 3, durationMs: 5 * 60 * 1000 },
  { attempts: 5, durationMs: 30 * 60 * 1000 },
  { attempts: 10, durationMs: 24 * 60 * 60 * 1000 },
];

function getLockoutDuration(attempts) {
  for (let i = LOCKOUT_LEVELS.length - 1; i >= 0; i--) {
    if (attempts >= LOCKOUT_LEVELS[i].attempts) {
      return LOCKOUT_LEVELS[i].durationMs;
    }
  }
  return null;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function generateAccessToken(usuario) {
  return jwt.sign(
    {
      sub: usuario.id,
      email: usuario.email,
      role: usuario.role,
      status: usuario.status ?? null, // inclui o status do usuário
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN },
  );
}

function generateRefreshToken(usuarioId, sessionId) {
  return jwt.sign(
    { sub: usuarioId, sessionId },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN },
  );
}

export function parseExpiresInSeconds(val) {
  const digits = /^(\d+)([smhd]?)$/;
  const match = String(val || '').match(digits);
  if (!match) return 30 * 24 * 60 * 60;
  const n = parseInt(match[1], 10);
  const unit = match[2] || 's';
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (multipliers[unit] || 1);
}

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

async function verifyPassword(password, storedHash) {
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }
  return verifyScryptPassword(password, storedHash);
}

async function checkRateLimit(email, ip = 'unknown') {
  if (config.NODE_ENV === 'development') return;
  let redis;
  try {
    redis = await getRedisClient();
  } catch {
    return;
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

  registrarEvento({
    usuarioId: usuario.id,
    actorType: 'USER',
    eventType: 'auth',
    eventAction: 'cadastro',
    ip: meta.ip,
    userAgent: meta.userAgent,
    sucesso: true,
  });

  try {
    const token = await generateEmailVerificationToken(usuario.id);
    const verifyLink = `${config.APP_URL}/verify-email?token=${token}`;
    await sendEmailVerification({ to: usuario.email, verifyLink });
    logger.info({ msg: 'Email de verificação enviado', email: usuario.email });
  } catch (err) {
    logger.error({ msg: 'Falha ao enviar email de verificação no cadastro', email: usuario.email, err: err.message });
  }

  return {
    usuario_id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    message: 'Cadastro realizado com sucesso. Verifique seu e-mail.',
  };
}

export async function login({ email, senha, device_info }, meta = {}) {
  await checkRateLimit(email, meta.ip || 'unknown');

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario) {
    registrarEvento({
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'login_falha',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { motivo: 'email_nao_encontrado' },
      sucesso: false,
    });
    throw AppError.unauthorized('Credenciais inválidas');
  }

  if (usuario.bloqueado_ate && usuario.bloqueado_ate > new Date()) {
    throw AppError.locked('Conta bloqueada temporariamente. Tente novamente mais tarde.');
  }

  if (STATUSES_BLOQUEIAM_LOGIN.includes(usuario.status)) {
    registrarEvento({
      usuarioId: usuario.id,
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'login_falha',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { motivo: 'conta_suspensa', status: usuario.status },
      sucesso: false,
    });
    throw AppError.forbidden('Conta suspensa. Entre em contato com o suporte.');
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

    registrarEvento({
      usuarioId: usuario.id,
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'login_falha',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { motivo: 'senha_incorreta', tentativas: newAttempts },
      sucesso: false,
    });

    if (lockDurationMs !== null) {
      throw AppError.locked('Conta bloqueada após múltiplas tentativas falhas.');
    }
    throw AppError.unauthorized('Credenciais inválidas');
  }

  await resetRateLimit(email, meta.ip || 'unknown');

  const refreshExpiresInSeconds = parseExpiresInSeconds(config.JWT_REFRESH_EXPIRES_IN);
  const dataExpiracao = new Date(Date.now() + refreshExpiresInSeconds * 1000);

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

  registrarEvento({
    usuarioId: usuario.id,
    actorType: 'USER',
    eventType: 'auth',
    eventAction: 'login_sucesso',
    ip: meta.ip,
    userAgent: meta.userAgent,
    sucesso: true,
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

export async function refresh(refreshToken, meta = {}) {
  let payload = null;
  try {
    payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
  } catch {
    registrarEvento({
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'refresh_falha',
      metadata: { motivo: 'token_invalido' },
      sucesso: false,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw AppError.unauthorized('Refresh token inválido ou expirado');
  }

  const tokenHash = sha256(refreshToken);
  const usuarioId = payload?.sub || null;

  const sessao = await prisma.usuarioSessao.findUnique({
    where: { refresh_token_hash: tokenHash },
    include: { usuario: true },
  });

  if (!sessao) {
    registrarEvento({
      usuarioId,
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'refresh_falha',
      metadata: { motivo: 'sessao_nao_encontrada' },
      sucesso: false,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw AppError.unauthorized('Sessão não encontrada');
  }

  if (sessao.data_revogacao) {
    registrarEvento({
      usuarioId,
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'refresh_falha',
      metadata: { motivo: 'sessao_revogada' },
      sucesso: false,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw AppError.unauthorized('Sessão revogada');
  }

  if (sessao.data_expiracao < new Date()) {
    registrarEvento({
      usuarioId,
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'refresh_falha',
      metadata: { motivo: 'sessao_expirada' },
      sucesso: false,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw AppError.unauthorized('Sessão expirada');
  }

  const usuario = sessao.usuario;

  if (STATUSES_BLOQUEIAM_LOGIN.includes(usuario.status)) {
    registrarEvento({
      usuarioId,
      actorType: 'USER',
      eventType: 'auth',
      eventAction: 'refresh_falha',
      metadata: { motivo: 'usuario_suspenso', status: usuario.status },
      sucesso: false,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    throw AppError.forbidden('Conta suspensa');
  }

  const accessToken = generateAccessToken(usuario);

  registrarEvento({
    usuarioId: usuario.id,
    actorType: 'USER',
    eventType: 'auth',
    eventAction: 'refresh_sucesso',
    sucesso: true,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { accessToken };
}

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

  registrarEvento({
    usuarioId: userId,
    actorType: 'USER',
    eventType: 'auth',
    eventAction: 'logout',
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { sessoes_revogadas: sessoesRevogadas },
    sucesso: true,
  });

  return { message: 'Logout realizado com sucesso', sessoes_revogadas: sessoesRevogadas };
}

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
