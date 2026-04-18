// apps/api/src/middleware/requireAtivo.js
import { AppError } from '../errors/AppError.js';
import { hasActiveSubscription } from '../config/accessPolicy.js';
import prisma from '../utils/database.js';
import logger from '../logger.js';

/**
 * Middleware que garante que o usuário tem assinatura ativa.
 * Observação: consulta o DB para garantir que cancelamentos via webhook
 * tenham efeito imediato, independentemente dos claims do JWT.
 */
export async function requireAtivo(req, _res, next) {
  try {
    if (!req.user?.sub) {
      return next(
        new AppError(
          'SEM_ASSINATURA',
          'Você precisa de um plano ativo para acessar este recurso.',
          403,
        ),
      );
    }

    // Sempre consultar o DB para obter o status atual
    let usuario;
    try {
      usuario = await prisma.usuario.findUnique({
        where: { id: req.user.sub },
        select: { status: true },
      });
    } catch (dbErr) {
      // Em caso de falha no DB, logamos e bloqueamos por segurança.
      logger.error({ err: dbErr, userId: req.user.sub }, 'Erro ao consultar status do usuário no requireAtivo');
      return next(
        new AppError(
          'SEM_ASSINATURA',
          'Você precisa de um plano ativo para acessar este recurso.',
          403,
        ),
      );
    }

    if (hasActiveSubscription(usuario?.status)) {
      // Atualiza req.user.status para refletir o estado real (útil para logs/handlers)
      req.user.status = usuario.status;
      return next();
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
