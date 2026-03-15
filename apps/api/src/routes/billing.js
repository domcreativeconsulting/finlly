import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { criarAssinatura, cancelarAssinatura, getStatusAssinatura } from '../services/billingService.js';
import { processarWebhookAsaas } from '../services/webhookService.js';
import { reconciliarAssinaturas } from '../services/reconciliacaoService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { toValidationError } from '../errors/toValidationError.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';

const router = Router();

// ============================================================
// Rate Limiters
// ============================================================

/** Rate limiter for webhook endpoint: 100 req/min per IP */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many requests.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

/** Rate limiter for billing routes: 30 req/15min per IP */
const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

/** Rate limiter for admin routes: 5 req/min per IP */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

// ============================================================
// Zod schema for subscribe
// ============================================================

const subscribeSchema = z.object({
  plano: z.enum(['mensal', 'anual']),
  ciclo: z.enum(['mensal', 'anual']),
  cupomCodigo: z.string().optional(),
});

// ============================================================
// POST /webhooks/asaas
// Not authenticated — uses HMAC signature verification.
// express.raw() is applied in index.js for this path before express.json().
// ============================================================

/**
 * Receives and processes Asaas webhook events.
 */
router.post(
  '/webhooks/asaas',
  webhookLimiter,
  async (req, res, next) => {
    const rawBody = req.body;

    let payload;
    if (Buffer.isBuffer(rawBody)) {
      try {
        payload = JSON.parse(rawBody.toString());
      } catch {
        return next(AppError.badRequest('Payload inválido'));
      }
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      // Body was pre-parsed (e.g. in test environment)
      payload = rawBody;
    } else {
      return next(AppError.badRequest('Payload inválido'));
    }

    const signatureHeader =
      req.headers['asaas-signature'] ?? req.headers['x-asaas-hmac-sha256'];

    try {
      const result = await processarWebhookAsaas(payload, rawBody, signatureHeader);
      logger.info({ result, event: payload.event }, 'Webhook Asaas processado');
      return res.status(200).json({ received: true });
    } catch (err) {
      return next(err);
    }
  },
);

// ============================================================
// Authenticated billing routes
// ============================================================

/**
 * POST /billing/subscribe
 * Creates or updates a subscription for the authenticated user.
 */
router.post('/billing/subscribe', billingLimiter, jwtAuthMiddleware, async (req, res, next) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const { assinante, paymentLink } = await criarAssinatura(req.user.sub, parsed.data);
    return res.status(201).json({
      message: 'Assinatura criada com sucesso',
      assinante,
      paymentLink,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /billing/cancel
 * Cancels the subscription of the authenticated user.
 */
router.post('/billing/cancel', billingLimiter, jwtAuthMiddleware, async (req, res, next) => {
  try {
    await cancelarAssinatura(req.user.sub);
    return res.status(200).json({ message: 'Assinatura cancelada com sucesso' });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /billing/status
 * Returns the subscription status of the authenticated user.
 */
router.get('/billing/status', billingLimiter, jwtAuthMiddleware, async (req, res, next) => {
  try {
    const assinante = await getStatusAssinatura(req.user.sub);
    return res.status(200).json({ assinante });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// Admin routes
// ============================================================

/**
 * POST /billing/admin/reconciliar
 * Triggers a manual reconciliation. Restricted to admin users.
 */
router.post('/billing/admin/reconciliar', adminLimiter, jwtAuthMiddleware, async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(AppError.forbidden('Acesso restrito a administradores'));
  }

  try {
    const summary = await reconciliarAssinaturas();
    logger.info({ summary, userId: req.user.sub }, 'Reconciliação manual disparada');
    return res.status(200).json(summary);
  } catch (err) {
    return next(err);
  }
});

export default router;
