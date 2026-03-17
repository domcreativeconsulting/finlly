import { AppError } from '../errors/AppError.js';
import { isStatusBlocked } from '../config/accessPolicy.js';

/**
 * Middleware that blocks access for users whose subscription status is listed in
 * {@link module:config/accessPolicy~BLOCKED_STATUSES} (currently `bloqueado_inadimplencia`).
 *
 * Assumes `jwtAuthMiddleware` has already run and populated `req.user`.
 * The blocked-status logic is centralised in {@link module:config/accessPolicy~isStatusBlocked}
 * so that the rule can be updated in a single place.
 *
 * @type {import('express').RequestHandler}
 */
export function requireAtivo(req, _res, next) {
  if (isStatusBlocked(req.user?.status)) {
    return next(
      new AppError(
        'INADIMPLENTE',
        'Sua assinatura está inadimplente. Regularize seu pagamento para continuar usando o serviço.',
        403,
      ),
    );
  }
  return next();
}
