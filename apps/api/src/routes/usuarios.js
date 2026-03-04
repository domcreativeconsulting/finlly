import { Router } from 'express';
import { z } from 'zod';
import { registerUser } from '../services/usuarioService.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';

const router = Router();

const createUsuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(8),
});

router.post('/usuarios', async (req, res, next) => {
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
