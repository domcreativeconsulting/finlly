import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { processarMensagemRecebida } from '../services/whatsappService.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';
import { config } from '../config/env.js';

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
// Middleware — Evolution API key validation
// ============================================================

/**
 * Validates the `apikey` request header against the configured EVOLUTION_API_KEY.
 * When EVOLUTION_API_KEY is not set, validation is skipped (permissive/dev mode).
 * Optionally validates the `instance` field in the body against EVOLUTION_INSTANCE.
 */
function evolutionApiKeyMiddleware(req, res, next) {
  const expectedApiKey = config.EVOLUTION_API_KEY;
  if (expectedApiKey) {
    const receivedApiKey = req.headers['apikey'];
    if (!receivedApiKey || receivedApiKey !== expectedApiKey) {
      logger.warn({ path: req.path }, 'Webhook Evolution: falha na validação do apikey');
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }
  }

  const expectedInstance = config.EVOLUTION_INSTANCE;
  if (expectedInstance && req.body && req.body.instance) {
    if (req.body.instance !== expectedInstance) {
      logger.warn({ path: req.path }, 'Webhook Evolution: instância não reconhecida');
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }
  }

  return next();
}

// ============================================================
// Zod schema — Evolution API webhook payload
// ============================================================

const whatsappWebhookSchema = z.object({
  event: z.string().min(1),
  instance: z.string().optional(),
  data: z.object({
    key: z.object({
      remoteJid: z.string().min(1),
      fromMe: z.boolean().optional(),
      id: z.string().optional(),
    }),
    messageTimestamp: z.number().optional(),
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
// Shared webhook handler
// ============================================================

async function handleWebhook(req, res, next) {
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
    const mensagem = await processarMensagemRecebida(payload);
    logger.info({ event: payload.event, from: mensagem.from }, 'Webhook WhatsApp processado');
    return res.status(200).json({ received: true });
  } catch (err) {
    return next(err);
  }
}

// ============================================================
// POST /webhooks/evolution  (primary — Story 12.1)
// POST /webhooks/whatsapp   (legacy alias — kept for backwards compatibility)
// Not authenticated via JWT — uses Evolution API key validation instead.
// ============================================================

router.post('/webhooks/evolution', webhookLimiter, evolutionApiKeyMiddleware, handleWebhook);
router.post('/webhooks/whatsapp', webhookLimiter, evolutionApiKeyMiddleware, handleWebhook);

export default router;
