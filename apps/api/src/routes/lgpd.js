import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { validate } from '../middleware/validate.js';
import { auditarAcao } from '../middleware/auditoria.js';
import { authLimiter, sensitiveWriteLimiter } from '../middleware/rateLimiter.js';
import { exportarDadosUsuario, anonimizarUsuario } from '../services/lgpd.service.js';
import { AppError } from '../errors/AppError.js';
import { confirmDeleteSchema } from '../schemas/lgpd.schemas.js';
import logger from '../logger.js';
import prisma from '../utils/database.js';

const router = Router();

/**
 * GET /lgpd/meus-dados
 * Retorna todos os dados pessoais do usuário autenticado (portabilidade LGPD).
 */
router.get(
  '/lgpd/meus-dados',
  authLimiter,
  jwtAuthMiddleware,
  requireAtivo,
  auditarAcao('dados_exportados'),
  async (req, res, next) => {
    try {
      const dados = await exportarDadosUsuario(req.user.sub);
      logger.info({ msg: 'Dados exportados via LGPD', userId: req.user.sub });
      return res.status(200).json(dados);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * DELETE /lgpd/minha-conta
 * Anonimiza e exclui (soft-delete) a conta do usuário autenticado (direito ao esquecimento LGPD).
 * Requer confirmação de senha.
 */
router.delete(
  '/lgpd/minha-conta',
  sensitiveWriteLimiter,
  jwtAuthMiddleware,
  requireAtivo,
  validate(confirmDeleteSchema),
  auditarAcao('conta_usuario_excluida', (req) => ({ motivo: 'solicitacao_lgpd' })),
  async (req, res, next) => {
    try {
      const usuarioId = req.user.sub;
      const { senha } = req.body;

      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { senha_hash: true },
      });

      if (!usuario) return next(AppError.notFound('Usuário não encontrado'));

      const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
      if (!senhaValida) return next(AppError.unauthorized('Senha incorreta'));

      const ip = req.ip || req.socket?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await anonimizarUsuario(usuarioId, { ip, userAgent });

      logger.info({ msg: 'Conta excluída via LGPD', userId: usuarioId });
      return res.status(200).json({ message: 'Conta removida com sucesso conforme LGPD.' });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
