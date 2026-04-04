import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { registerUser } from '../services/usuarioService.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import { buildStore } from '../utils/rateLimitStore.js';
import { config } from '../config/env.js';
import logger from '../logger.js';

const router = Router();

/** Registration limiter: 10 requests per hour per IP. */
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const registerLimiter = rateLimit({
  windowMs: REGISTER_WINDOW_MS,
  max: 10,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(REGISTER_WINDOW_MS),
  message: {
    code: 'RATE_LIMITED',
    message: 'Muitas tentativas de registro. Tente novamente em 1 hora.',
  },
  handler: (req, res, next, options) => {
    logger.warn({ msg: 'Register rate limit atingido', ip: req.ip });
    return next(AppError.tooManyRequests(options.message.message));
  },
});

const createUsuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(8),
});

router.post('/usuarios', registerLimiter, async (req, res, next) => {
  const parsed = createUsuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(toValidationError(parsed.error));
  }

  try {
    const usuario = await registerUser(parsed.data);
    logger.info({ msg: 'Usuário criado com sucesso', usuarioId: usuario.id });
    return res.status(201).json({ message: 'Usuário criado com sucesso', usuario });
  } catch (err) {
    if (err.code === 'P2002') {
      return next(AppError.conflict('Email já cadastrado'));
    }
    return next(err);
  }
});

export default router;
