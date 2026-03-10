import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { getPerfil, updatePerfil } from '../services/perfilService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';

const router = Router();

/** General limiter for profile endpoints: 30 requests per 15 minutes per IP. */
const perfilLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const UpdatePerfilSchema = z.object({
  nome: z.string().min(3).max(255).optional(),
  whatsapp: z.string().max(20).regex(/^\+?[\d\s\-().]+$/, 'Número inválido').optional().nullable(),
  timezone: z.string().max(50).optional(),
  moeda: z.string().length(3).transform(val => val.toUpperCase()).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Nenhum campo fornecido para atualização',
});

/**
 * GET /perfil
 * Retorna o perfil completo do usuário autenticado.
 */
router.get('/perfil', perfilLimiter, jwtAuthMiddleware, async (req, res, next) => {
  try {
    const usuario = await getPerfil(req.user.sub);
    return res.status(200).json(usuario);
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /perfil
 * Atualiza parcialmente o perfil do usuário autenticado.
 */
router.patch('/perfil', perfilLimiter, jwtAuthMiddleware, async (req, res, next) => {
  const parsed = UpdatePerfilSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(toValidationError(parsed.error));
  }

  try {
    const usuario = await updatePerfil(req.user.sub, parsed.data);
    logger.info({ msg: 'Perfil atualizado', userId: req.user.sub });
    return res.status(200).json(usuario);
  } catch (err) {
    return next(err);
  }
});

export default router;
