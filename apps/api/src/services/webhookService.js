import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';
import logger from '../logger.js';

const GRACE_PERIOD_DAYS = 3;

/**
 * Verifies the Asaas HMAC signature.
 * @param {Buffer|string} rawBody
 * @param {string} signature
 * @returns {boolean}
 */
function verificarAssinatura(rawBody, signature) {
  if (!config.ASAAS_WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw AppError.internal('ASAAS_WEBHOOK_SECRET não configurado em produção');
    }
    // In non-production environments, skip signature check with a warning
    return true;
  }

  const hmac = createHmac('sha256', config.ASAAS_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Finds the subscriber associated with a webhook payload.
 * @param {object} payload
 * @returns {Promise<object|null>}
 */
async function encontrarAssinante(payload) {
  // Try via externalReference from payment or subscription
  const externalRef =
    payload.payment?.externalReference ||
    payload.subscription?.externalReference;

  if (externalRef) {
    const assinante = await prisma.assinante.findFirst({
      where: { usuario_id: externalRef, deleted_at: null },
    });
    if (assinante) return assinante;
  }

  // Fallback: by subscription ID
  const subscriptionId =
    payload.payment?.subscription || payload.subscription?.id;

  if (subscriptionId) {
    const assinante = await prisma.assinante.findFirst({
      where: { provider_subscription_id: subscriptionId, deleted_at: null },
    });
    if (assinante) return assinante;
  }

  // Fallback: by customer ID
  const customerId = payload.payment?.customer || payload.subscription?.customer;
  if (customerId) {
    const assinante = await prisma.assinante.findFirst({
      where: { provider_customer_id: customerId, deleted_at: null },
    });
    if (assinante) return assinante;
  }

  return null;
}

/**
 * Upserts a payment record by provider_payment_id (no unique index, manual check).
 * @param {string} providerPaymentId
 * @param {object} updateData
 * @param {object} createData
 */
async function upsertPagamento(providerPaymentId, updateData, createData) {
  const existing = await prisma.assinantePagamento.findFirst({
    where: { provider_payment_id: providerPaymentId },
  });

  if (existing) {
    await prisma.assinantePagamento.update({
      where: { id: existing.id },
      data: { ...updateData, updated_at: new Date() },
    });
  } else {
    await prisma.assinantePagamento.create({ data: createData });
  }
}

/**
 * Handles PAYMENT_RECEIVED / PAYMENT_CONFIRMED events.
 * @param {object} payload
 */
async function handlePaymentConfirmed(payload) {
  const assinante = await encontrarAssinante(payload);
  if (!assinante) {
    logger.warn({ msg: 'Assinante not found for payment confirmed event', paymentId: payload.payment?.id });
    return;
  }

  const payment = payload.payment || {};

  await prisma.$transaction(async (tx) => {
    // Upsert the payment record
    if (payment.id) {
      const existing = await tx.assinantePagamento.findFirst({
        where: { provider_payment_id: payment.id },
      });

      if (existing) {
        await tx.assinantePagamento.update({
          where: { id: existing.id },
          data: {
            status: 'pago',
            data_pagamento: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
            updated_at: new Date(),
          },
        });
      } else {
        await tx.assinantePagamento.create({
          data: {
            assinante_id: assinante.id,
            usuario_id: assinante.usuario_id,
            status: 'pago',
            valor: payment.value || 0,
            provider: 'asaas',
            provider_payment_id: payment.id,
            descricao: payment.description || null,
            data_pagamento: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
            data_vencimento: payment.dueDate ? new Date(payment.dueDate) : null,
          },
        });
      }
    }

    // Activate subscription
    await tx.assinante.update({
      where: { id: assinante.id },
      data: {
        status: 'ativo',
        updated_at: new Date(),
      },
    });

    // Unblock user if blocked for delinquency
    await tx.usuario.update({
      where: { id: assinante.usuario_id },
      data: { status: 'ativo', updated_at: new Date() },
    });
  });

  logger.info({ msg: 'Payment confirmed processed', paymentId: payment.id, assinanteId: assinante.id });
}

/**
 * Handles PAYMENT_OVERDUE event.
 * @param {object} payload
 */
async function handlePaymentOverdue(payload) {
  const assinante = await encontrarAssinante(payload);
  if (!assinante) {
    logger.warn({ msg: 'Assinante not found for payment overdue event', paymentId: payload.payment?.id });
    return;
  }

  const payment = payload.payment || {};

  // Upsert payment record as pending/overdue
  if (payment.id) {
    const existing = await prisma.assinantePagamento.findFirst({
      where: { provider_payment_id: payment.id },
    });

    if (existing) {
      await prisma.assinantePagamento.update({
        where: { id: existing.id },
        data: { status: 'pendente', updated_at: new Date() },
      });
    } else {
      await prisma.assinantePagamento.create({
        data: {
          assinante_id: assinante.id,
          usuario_id: assinante.usuario_id,
          status: 'pendente',
          valor: payment.value || 0,
          provider: 'asaas',
          provider_payment_id: payment.id,
          descricao: payment.description || null,
          data_vencimento: payment.dueDate ? new Date(payment.dueDate) : null,
        },
      });
    }
  }

  // Check if grace period has expired
  const proximaCobranca = assinante.proxima_cobranca || new Date();
  const gracePeriodExpiry = new Date(proximaCobranca);
  gracePeriodExpiry.setDate(gracePeriodExpiry.getDate() + GRACE_PERIOD_DAYS);

  if (new Date() > gracePeriodExpiry) {
    // Grace period expired — block user
    await prisma.$transaction(async (tx) => {
      await tx.assinante.update({
        where: { id: assinante.id },
        data: { status: 'inadimplente', updated_at: new Date() },
      });

      await tx.usuario.update({
        where: { id: assinante.usuario_id },
        data: { status: 'bloqueado_inadimplencia', updated_at: new Date() },
      });
    });

    logger.warn({ msg: 'User blocked for delinquency (grace period expired)', assinanteId: assinante.id, usuarioId: assinante.usuario_id });
  } else {
    logger.info({ msg: 'Payment overdue within grace period', assinanteId: assinante.id, gracePeriodExpiry });
  }
}

/**
 * Handles PAYMENT_DELETED / PAYMENT_REFUNDED events.
 * @param {object} payload
 */
async function handlePaymentRefunded(payload) {
  const payment = payload.payment || {};
  if (!payment.id) return;

  await prisma.assinantePagamento.updateMany({
    where: { provider_payment_id: payment.id },
    data: { status: 'estornado', updated_at: new Date() },
  });

  logger.info({ msg: 'Payment refunded/deleted', paymentId: payment.id });
}

/**
 * Handles SUBSCRIPTION_INACTIVATED event.
 * @param {object} payload
 */
async function handleSubscriptionInactivated(payload) {
  const assinante = await encontrarAssinante(payload);
  if (!assinante) {
    logger.warn({ msg: 'Assinante not found for subscription inactivated event' });
    return;
  }

  await prisma.assinante.update({
    where: { id: assinante.id },
    data: { status: 'cancelado', updated_at: new Date() },
  });

  logger.info({ msg: 'Subscription inactivated', assinanteId: assinante.id });
}

/**
 * Processes an Asaas webhook with idempotency guarantee.
 * @param {Buffer|string} rawBody
 * @param {string} signature
 * @param {object} payload
 * @returns {Promise<void>}
 */
export async function processarWebhookAsaas(rawBody, signature, payload) {
  // 1. Verify HMAC signature
  if (signature && !verificarAssinatura(rawBody, signature)) {
    throw AppError.unauthorized('Webhook signature inválida');
  }

  const eventId = payload.id || payload.event;
  const eventType = payload.event;

  if (!eventId || !eventType) {
    logger.warn({ msg: 'Webhook payload missing id or event field', payload });
    return;
  }

  // 2. Idempotency: try to insert webhook event
  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: {
        provider: 'asaas',
        event_id: String(eventId),
        event_type: eventType,
        payload: payload,
        processado: false,
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation (already processed)
    if (err?.code === 'P2002') {
      const existing = await prisma.webhookEvent.findFirst({
        where: { provider: 'asaas', event_id: String(eventId) },
      });
      if (existing?.processado) {
        logger.info({ msg: 'Webhook event already processed (idempotent)', eventId });
        return;
      }
      webhookEvent = existing;
    } else {
      throw err;
    }
  }

  // 3. Process event
  try {
    switch (eventType) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await handlePaymentConfirmed(payload);
        break;
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(payload);
        break;
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(payload);
        break;
      case 'SUBSCRIPTION_INACTIVATED':
        await handleSubscriptionInactivated(payload);
        break;
      default:
        logger.info({ msg: 'Unhandled Asaas webhook event', eventType });
        break;
    }

    // 4. Mark as processed
    if (webhookEvent?.id) {
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processado: true, processado_em: new Date() },
      });
    }
  } catch (err) {
    // Update error field and re-throw for Asaas retry
    if (webhookEvent?.id) {
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { erro: err.message },
      }).catch(() => {}); // ignore update error
    }
    throw err;
  }
}
