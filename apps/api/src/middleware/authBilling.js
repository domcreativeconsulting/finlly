// apps/api/src/middlewares/authBilling.js
import prisma from '../utils/database.js';
import logger from '../logger.js';

const ALLOWED_LOGIN = ['ativo', 'ativo_restrito', 'trial'];

/**
 * Garante que o usuário está autenticado e possui um status que permite login.
 * Pressupõe que req.user já foi preenchido pelo middleware de autenticação JWT.
 */
export function ensureLoggedIn(req, res, next) {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ code: 'UNAUTHORIZED', message: 'Token ausente' });

    if (!ALLOWED_LOGIN.includes(String(req.user.status))) {
      return res
        .status(403)
        .json({ code: 'FORBIDDEN', message: 'Acesso negado' });
    }

    return next();
  } catch (err) {
    logger.error({ err }, 'Erro em ensureLoggedIn');
    return res.status(500).json({ code: 'INTERNAL_ERROR' });
  }
}

/**
 * Carrega o assinante do usuário e anexa em req.assinante.
 * Uso: colocar este middleware antes de ensureBillingActive ou rotas que precisam dos dados do assinante.
 */
export async function loadAssinante(req, res, next) {
  try {
    if (req.assinante) return next();

    const usuarioId = req.user?.sub; // usar sub (id do JWT), não .id
    if (!usuarioId) return res.status(401).json({ code: 'UNAUTHORIZED' });

    // usar o model correto e findFirst / findUnique conforme esquema
    const assinante = await prisma.assinante.findFirst({
      where: { usuario_id: usuarioId, deleted_at: null },
    });

    req.assinante = assinante ?? null;
    return next();
  } catch (err) {
    logger.error({ err }, 'Erro em loadAssinante');
    return res.status(500).json({ code: 'INTERNAL_ERROR' });
  }
}

/**
 * Garante que o assinante está ativo; caso contrário retorna 403 (BILLING_REQUIRED).
 * Usa req.assinante (tente sempre executar loadAssinante antes).
 */
export async function ensureBillingActive(req, res, next) {
  try {
    const assinante =
      req.assinante ??
      (req.user
        ? await prisma.assinante.findFirst({
            where: { usuario_id: req.user.sub, deleted_at: null },
          })
        : null);

    if (!assinante || assinante.status !== 'ativo') {
      return res.status(403).json({
        code: 'BILLING_REQUIRED',
        message: 'Funcionalidade disponível apenas para assinantes ativos',
      });
    }

    // tudo ok
    req.assinante = assinante;
    return next();
  } catch (err) {
    logger.error({ err }, 'Erro em ensureBillingActive');
    return res
      .status(403)
      .json({
        code: 'BILLING_REQUIRED',
        message: 'Funcionalidade disponível apenas para assinantes ativos',
      });
  }
}
