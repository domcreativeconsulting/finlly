import { AppError } from '../errors/AppError.js';

/**
 * Middleware that blocks access for users with status `bloqueado_inadimplencia`.
 * Assumes `jwtAuthMiddleware` has already run and populated `req.user`.
 *
 * @type {import('express').RequestHandler}
 */
export function requireAtivo(req, _res, next) {
  if (req.user?.status === 'bloqueado_inadimplencia') {
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
