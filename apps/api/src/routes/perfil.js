import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { getPerfil, updatePerfil } from '../services/perfilService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { ensureLoggedIn, loadAssinante, ensureBillingActive } from '../middleware/authBilling.js';
import { validate } from '../middleware/validate.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';
import { updatePerfilSchema } from '../schemas/perfil.schemas.js';

const router = Router();

/** General limiter for profile endpoints: 30 requests per 15 minutes per user/IP. */
const perfilLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

/**
 * GET /perfil
 * Retorna o perfil completo do usuário autenticado.
 */
async function handleGetPerfil(req, res, next) {
  try {
    const usuario = await getPerfil(req.user.sub);
    return res.status(200).json(usuario);
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH/PUT handler — atualiza o perfil do usuário autenticado.
 */
async function handleUpdatePerfil(req, res, next) {
  try {
    const usuario = await updatePerfil(req.user.sub, req.body);
    logger.info({ msg: 'Perfil atualizado', userId: req.user.sub });
    return res.status(200).json(usuario);
  } catch (err) {
    return next(err);
  }
}

router.get('/perfil', perfilLimiter, jwtAuthMiddleware, handleGetPerfil);

/**
 * PATCH /perfil
 * Atualiza parcialmente o perfil do usuário autenticado.
 */
router.patch('/perfil', perfilLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('perfil_atualizado'), validate(updatePerfilSchema), handleUpdatePerfil);

/**
 * PUT /users/me  (alias para compatibilidade com a spec da task)
 * Delega para o mesmo handler de PATCH /perfil.
 */
router.put('/users/me', perfilLimiter, jwtAuthMiddleware, requireAtivo, auditarAcao('perfil_atualizado'), validate(updatePerfilSchema), handleUpdatePerfil);

/**
 * GET /users/me  (alias para compatibilidade com a spec da task)
 */
router.get('/users/me', perfilLimiter, jwtAuthMiddleware, handleGetPerfil);

export default router;
