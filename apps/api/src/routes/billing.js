import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { toValidationError } from '../errors/toValidationError.js';
import { criarAssinatura, getStatusAssinatura, cancelarAssinatura } from '../services/billingService.js';

const router = Router();

// ============================================================
// Rate Limiter for checkout (10 req/min per user)
// ============================================================

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `billing:checkout:${req.user?.sub || req.ip}`,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas de checkout. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// Validation schemas
// ============================================================

const checkoutSchema = z.object({
  plano: z.string().min(1, 'Plano é obrigatório'),
  ciclo: z.enum(['mensal', 'anual'], { error: 'Ciclo deve ser mensal ou anual' }),
  cupom: z.string().optional(),
});

// ============================================================
// Routes
// ============================================================

/**
 * POST /billing/checkout
 * Creates or updates a subscription for the authenticated user.
 */
router.post('/billing/checkout', jwtAuthMiddleware, checkoutLimiter, async (req, res, next) => {
  try {
    const parseResult = checkoutSchema.safeParse(req.body);
    if (!parseResult.success) {
      return next(toValidationError(parseResult.error));
    }

    const { plano, ciclo, cupom } = parseResult.data;
    const result = await criarAssinatura(req.user.sub, { plano, ciclo, cupomCodigo: cupom });

    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /billing/status
 * Returns the subscription status and recent payments for the authenticated user.
 */
router.get('/billing/status', jwtAuthMiddleware, async (req, res, next) => {
  try {
    const result = await getStatusAssinatura(req.user.sub);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /billing/cancelar
 * Cancels the subscription for the authenticated user.
 */
router.post('/billing/cancelar', jwtAuthMiddleware, async (req, res, next) => {
  try {
    await cancelarAssinatura(req.user.sub);
    return res.json({ message: 'Assinatura cancelada com sucesso' });
  } catch (err) {
    return next(err);
  }
});

export default router;
