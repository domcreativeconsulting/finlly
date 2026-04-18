// apps/api/src/middleware/requireAtivo.js
import { AppError } from '../errors/AppError.js';
import { hasActiveSubscription } from '../config/accessPolicy.js';
import prisma from '../utils/database.js';
import logger from '../logger.js';

/**
 * Middleware que garante que o usuário tem assinatura ativa.
 * Primeiro usa o claim no token (rápido); se estiver negativo, busca o status
 * atual no banco (garante que cancelamentos via webhook são aplicados imediatamente).
 */
export async function requireAtivo(req, _res, next) {
  try {
    // Se token já indica ativo, deixa passar sem hit no DB
    if (hasActiveSubscription(req.user?.status)) {
      return next();
    }

    // Fallback: buscar status atual no banco (garante efeito imediato de webhooks)
    if (!req.user?.sub) {
      return next(
        new AppError(
          'SEM_ASSINATURA',
          'Você precisa de um plano ativo para acessar este recurso.',
          403,
        ),
      );
    }

    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user.sub },
        select: { status: true },
      });

      if (hasActiveSubscription(usuario?.status)) {
        // Atualiza req.user.status para refletir estado real (útil para logs / handlers)
        req.user.status = usuario.status;
        return next();
      }
    } catch (dbErr) {
      // Não falhar por completo se DB indisponível — mas logue
      logger.warn({ err: dbErr, userId: req.user.sub }, 'Falha ao consultar status do usuário no DB dentro do requireAtivo');
      // Opcional: decidir se bloqueia ou permite quando DB indisponível. Aqui bloqueia por segurança.
    }

    return next(
      new AppError(
        'SEM_ASSINATURA',
        'Você precisa de um plano ativo para acessar este recurso.',
        403,
      ),
    );
  } catch (err) {
    return next(err);
  }
}
