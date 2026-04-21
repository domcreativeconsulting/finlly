import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import { criarAssinatura, cancelarAssinatura, getStatusAssinatura } from '../services/billingService.js';
import { processarWebhookAsaas } from '../services/webhookService.js';
import { reconciliarAssinaturas } from '../services/reconciliacaoService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';
import { subscribeSchema } from '../schemas/billing.schemas.js';

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

/** Rate limiter for billing routes: 30 req/15min per user/IP */
const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

/** Rate limiter for admin routes: 5 req/min per user/IP */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

// ============================================================
// POST /webhooks/asaas
// ============================================================

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
      payload = rawBody;
    } else {
      return next(AppError.badRequest('Payload inválido'));
    }

    const signatureHeader =
  req.headers['asaas-access-token'] ??
  req.headers['asaas-signature'] ??
  req.headers['x-asaas-hmac-sha256'];


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
 * Passes remoteIp for credit card transactions (required by Asaas).
 */
router.post('/billing/subscribe', billingLimiter, jwtAuthMiddleware, validate({ body: subscribeSchema }), async (req, res, next) => {
  try {
    const remoteIp =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      '127.0.0.1';

    const { assinante, paymentLink, pixQrCode, pixCopiaECola } = await criarAssinatura(req.user.sub, {
      ...req.body,
      remoteIp,
    });

    return res.status(201).json({
      message: 'Assinatura criada com sucesso',
      assinante,
      paymentLink,
      pixQrCode,
      pixCopiaECola,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /billing/cancel
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
