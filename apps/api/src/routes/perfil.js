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

const IANA_TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza',
  'America/Recife', 'America/Maceio', 'America/Bahia', 'America/Cuiaba',
  'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco',
  'America/Noronha', 'America/Araguaina',
  'UTC', 'Europe/Lisbon', 'Europe/London', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Mexico_City', 'America/Argentina/Buenos_Aires',
  'America/Lima', 'America/Bogota', 'America/Santiago',
  'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
  'Australia/Sydney', 'Pacific/Auckland',
];

const UpdatePerfilSchema = z.object({
  nome: z.string().min(3).max(255).optional(),
  whatsapp: z.string().max(20).regex(/^\+?[\d\s\-().]+$/, 'Número inválido').optional().nullable(),
  timezone: z
    .string()
    .refine((tz) => IANA_TIMEZONES.includes(tz), {
      message: `Timezone inválida. Use um identificador IANA válido (ex: 'America/Sao_Paulo', 'UTC')`,
    })
    .optional(),
  moeda: z.string().length(3).transform(val => val.toUpperCase()).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Nenhum campo fornecido para atualização',
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
}

router.get('/perfil', perfilLimiter, jwtAuthMiddleware, handleGetPerfil);

/**
 * PATCH /perfil
 * Atualiza parcialmente o perfil do usuário autenticado.
 */
router.patch('/perfil', perfilLimiter, jwtAuthMiddleware, handleUpdatePerfil);

/**
 * PUT /users/me  (alias para compatibilidade com a spec da task)
 * Delega para o mesmo handler de PATCH /perfil.
 */
router.put('/users/me', perfilLimiter, jwtAuthMiddleware, handleUpdatePerfil);

/**
 * GET /users/me  (alias para compatibilidade com a spec da task)
 */
router.get('/users/me', perfilLimiter, jwtAuthMiddleware, handleGetPerfil);

export default router;
