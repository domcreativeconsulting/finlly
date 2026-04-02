import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { processarMensagemRecebida } from '../services/whatsappService.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';

const router = Router();

/** Rate limiter for the webhook endpoint: 200 req/min per IP */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many requests.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

// ============================================================
// Zod schema — Evolution API webhook payload
// ============================================================

const whatsappWebhookSchema = z.object({
  event: z.string().min(1),
  data: z.object({
    key: z.object({
      remoteJid: z.string().min(1),
      fromMe: z.boolean().optional(),
    }),
    message: z
      .object({
        conversation: z.string().optional(),
        extendedTextMessage: z
          .object({
            text: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    pushName: z.string().optional(),
  }),
});

// ============================================================
// POST /webhooks/whatsapp
// Not authenticated — receives events from Evolution API.
// ============================================================

/**
 * Receives and processes WhatsApp webhook events from the Evolution API.
 */
router.post('/webhooks/whatsapp', webhookLimiter, (req, res, next) => {
  const parsed = whatsappWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(toValidationError(parsed.error));
  }

  const payload = parsed.data;

  // Only process incoming messages; silently acknowledge other events.
  if (payload.event !== 'messages.upsert') {
    logger.info({ event: payload.event }, 'Evento WhatsApp ignorado');
    return res.status(200).json({ received: true });
  }

  try {
    const mensagem = processarMensagemRecebida(payload);
    logger.info({ event: payload.event, from: mensagem.from }, 'Webhook WhatsApp processado');
    return res.status(200).json({ received: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
