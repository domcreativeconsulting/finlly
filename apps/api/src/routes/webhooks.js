import { Router } from 'express';
import express from 'express';
import { processarWebhookAsaas } from '../services/webhookService.js';
import logger from '../logger.js';

const router = Router();

/**
 * POST /webhooks/asaas
 * Receives Asaas webhook events.
 * Uses express.raw to capture raw body for HMAC verification.
 */
router.post(
  '/webhooks/asaas',
  express.raw({ type: '*/*' }),
  async (req, res, next) => {
    try {
      const rawBody = req.body; // Buffer
      const signature = req.headers['asaas-access-token'];

      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        logger.warn({ msg: 'Invalid JSON in webhook body' });
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      await processarWebhookAsaas(rawBody, signature, payload);

      return res.status(200).json({ received: true });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
