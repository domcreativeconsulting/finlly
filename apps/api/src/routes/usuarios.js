import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { registerUser } from '../services/usuarioService.js';
import { AppError } from '../errors/AppError.js';
import { validate } from '../middleware/validate.js';
import { buildStore } from '../utils/rateLimitStore.js';
import { config } from '../config/env.js';
import logger from '../logger.js';
import { createUsuarioSchema } from '../schemas/usuario.schemas.js';

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

router.post('/usuarios', registerLimiter, validate(createUsuarioSchema), async (req, res, next) => {
  try {
    const usuario = await registerUser(req.body);
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
