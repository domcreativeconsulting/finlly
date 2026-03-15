import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import express from 'express';
import { criarAssinatura, cancelarAssinatura, getStatusAssinatura } from '../services/billingService.js';
import { processarWebhookAsaas } from '../services/webhookService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { toValidationError } from '../errors/toValidationError.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';

const router = Router();

/** Rate limiter for webhook endpoint: 100 req/min per IP */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many requests.' },
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
// POST /billing/subscribe
// ============================================================

/**
 * Creates or updates a subscription for the authenticated user.
 */
router.post('/billing/subscribe', jwtAuthMiddleware, async (req, res, next) => {
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

// ============================================================
// POST /billing/cancel
// ============================================================

/**
 * Cancels the subscription of the authenticated user.
 */
router.post('/billing/cancel', jwtAuthMiddleware, async (req, res, next) => {
  try {
    await cancelarAssinatura(req.user.sub);
    return res.status(200).json({ message: 'Assinatura cancelada com sucesso' });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// GET /billing/status
// ============================================================

/**
 * Returns the subscription status of the authenticated user.
 */
router.get('/billing/status', jwtAuthMiddleware, async (req, res, next) => {
  try {
    const assinante = await getStatusAssinatura(req.user.sub);
    return res.status(200).json({ assinante });
  } catch (err) {
    return next(err);
  }
});

// ============================================================
// POST /webhooks/asaas
// ============================================================

/**
 * Receives and processes Asaas webhook events.
 * Not authenticated — uses HMAC signature verification instead.
 */
router.post(
  '/webhooks/asaas',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      return next(AppError.badRequest('Payload inválido'));
    }

    const signatureHeader =
      req.headers['asaas-signature'] ?? req.headers['x-asaas-hmac-sha256'];

    try {
      const result = await processarWebhookAsaas(payload, req.body, signatureHeader);
      logger.info({ result, event: payload.event }, 'Webhook Asaas processado');
      return res.status(200).json({ received: true });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
