// apps/api/src/middleware/requireAtivo.js
import { AppError } from '../errors/AppError.js';
import { hasActiveSubscription } from '../config/accessPolicy.js';
import prisma from '../utils/database.js';
import logger from '../logger.js';

/**
 * Middleware que garante que o usuário tem assinatura ativa.
 * Prioriza checar o registro `assinante` (fonte da informação de billing).
 * Se não houver assinante, faz fallback para usuario.status.
 */
export async function requireAtivo(req, _res, next) {
  try {
    if (!req.user?.sub) {
      return next(new AppError('SEM_ASSINATURA', 'Você precisa de um plano ativo para acessar este recurso.', 403));
    }

    // 1) Tenta checar o registro de assinante (fonte-of-truth para pagamento)
    try {
      const assinante = await prisma.assinante.findFirst({
        where: { usuario_id: req.user.sub, deleted_at: null },
        select: { status: true },
      });

      if (assinante) {
        // considerar ativo quando assinante.status for 'ativo' ou 'pendente' conforme regra
        // (ajuste se a política mudar)
        if (assinante.status === 'ativo' || assinante.status === 'pendente') {
          // opcional: atualizar req.user.status para consistência
          req.user.status = assinante.status;
          return next();
        }
        // assinante existe mas não está em estado ativo -> bloqueia
        return next(new AppError('SEM_ASSINATURA', 'Você precisa de um plano ativo para acessar este recurso.', 403));
      }
    } catch (err) {
      // log e fallback para usuario.status
      logger.warn({ err, userId: req.user.sub }, 'Erro consultando assinante no requireAtivo, fallback para usuario.status');
    }

    // 2) Fallback: checar usuario.status (existente)
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.user.sub },
        select: { status: true },
      });

      if (hasActiveSubscription(usuario?.status)) {
        req.user.status = usuario.status;
        return next();
      }
    } catch (err) {
      logger.error({ err, userId: req.user.sub }, 'Erro consultando usuario no requireAtivo');
      // bloquear por segurança se DB apresentar erro
      return next(new AppError('SEM_ASSINATURA', 'Você precisa de um plano ativo para acessar este recurso.', 403));
    }

    return next(new AppError('SEM_ASSINATURA', 'Você precisa de um plano ativo para acessar este recurso.', 403));
  } catch (err) {
    return next(err);
  }
}
