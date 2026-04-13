import { AppError } from '../errors/AppError.js';
import { hasActiveSubscription } from '../config/accessPolicy.js';

/**
 * Middleware that blocks access for users who do not have an active subscription.
 *
 * Only users with status `ativo`, `trial` or `pendente` (as defined in
 * {@link module:config/accessPolicy~ALLOWED_STATUSES}) are permitted through.
 * All other statuses — including `inativo`, `cancelado`,
 * `bloqueado_inadimplencia`, `undefined` and absent users — are rejected.
 *
 * Assumes `jwtAuthMiddleware` has already run and populated `req.user`.
 * The allowed-status logic is centralised in
 * {@link module:config/accessPolicy~hasActiveSubscription} so that the rule
 * can be updated in a single place.
 *
 * @type {import('express').RequestHandler}
 */
export function requireAtivo(req, _res, next) {
  if (!hasActiveSubscription(req.user?.status)) {
    return next(
      new AppError(
        'SEM_ASSINATURA',
        'Você precisa de um plano ativo para acessar este recurso.',
        403,
      ),
    );
  }
  return next();
}
