import { Router } from 'express';
import { z } from 'zod';
import { registerUser } from '../services/usuarioService.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';

const router = Router();

const cadastroSchema = z.object({
  nome: z.string().min(1).max(255),
  email: z.string().email(),
  senha: z.string().min(8),
});

router.post('/usuarios', async (req, res, next) => {
  try {
    const parsed = cadastroSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(toValidationError({ errors: parsed.error.issues }));
    }

    const usuario = await registerUser(parsed.data);

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      usuario,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return next(AppError.conflict('E-mail já cadastrado'));
    }
    logger.error({ msg: 'Erro ao registrar usuário', error: err.message });
    next(err);
  }
});

export default router;
