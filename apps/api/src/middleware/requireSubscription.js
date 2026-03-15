import prisma from '../utils/database.js';
import { getRedisClient } from '../utils/redisClient.js';
import { AppError } from '../errors/AppError.js';

const CACHE_TTL_SECONDS = 60;
const CACHE_KEY_PREFIX = 'billing:status:';

/**
 * Middleware that verifies the user has an active subscription.
 * Uses Redis cache (60s) to avoid hitting the DB on every request.
 * @type {import('express').RequestHandler}
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return next(AppError.unauthorized('Token ausente'));
    }

    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;

    // Try Redis cache first
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const { blocked, reason } = JSON.parse(cached);
        if (blocked) {
          return next(new AppError(reason.code, reason.message, 402));
        }
        return next();
      }
    } catch {
      // Redis unavailable — fall through to DB check
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        assinante: {
          select: { status: true },
        },
      },
    });

    if (!usuario) {
      return next(AppError.unauthorized('Usuário não encontrado'));
    }

    // Check for delinquency block
    if (usuario.status === 'bloqueado_inadimplencia') {
      const reason = {
        code: 'SUBSCRIPTION_BLOCKED',
        message: 'Acesso bloqueado por inadimplência. Regularize sua assinatura.',
      };

      // Cache negative result
      try {
        const redis = await getRedisClient();
        await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify({ blocked: true, reason }));
      } catch {
        // ignore Redis errors
      }

      return next(new AppError(reason.code, reason.message, 402));
    }

    // Check for missing or cancelled subscription
    if (!usuario.assinante || usuario.assinante.status === 'cancelado' || usuario.assinante.status === 'inativo') {
      const reason = {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Assinatura não encontrada ou cancelada. Assine um plano para continuar.',
      };

      // Cache negative result
      try {
        const redis = await getRedisClient();
        await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify({ blocked: true, reason }));
      } catch {
        // ignore Redis errors
      }

      return next(new AppError(reason.code, reason.message, 402));
    }

    // Cache positive result
    try {
      const redis = await getRedisClient();
      await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify({ blocked: false }));
    } catch {
      // ignore Redis errors
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
