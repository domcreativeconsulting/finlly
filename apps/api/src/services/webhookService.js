import { createHash, timingSafeEqual } from 'crypto';
import { Buffer } from 'buffer';
import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';
import logger from '../logger.js';
import {
  atualizarStatusAssinante,
  mapAsaasStatusToLocal,
  invalidateBillingCache,
} from './assinanteStatusService.js';
import { registrarEvento } from './auditoria.service.js';

/**
 * Calculates a SHA-256 hex digest of the given payload object.
 * Used as a secondary deduplication key in webhook_events.
 *
 * JSON.stringify is used without key sorting by design: the payload is passed
 * directly from the Asaas webhook request without any transformation, so the
 * key order is always consistent for the same event. This matches the backfill
 * query in the migration, which uses payload::text (Postgres JSON text output).
 * Note: the Postgres text representation may differ from JSON.stringify for
 * existing rows — the backfill covers only dev/test data and is best-effort.
 * @param {object} payload
 * @returns {string} 64-char hex string
 */
function computePayloadHash(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Verifies the HMAC-SHA256 signature of a webhook payload.
 * @param {Buffer|string} rawBody
 * @param {string} signature
 * @throws {AppError} if the signature is invalid
 */
function verificarAssinatura(rawBody, signatureHeader) {
  const secret = config.ASAAS_WEBHOOK_SECRET;
  if (!secret) return;

  // Asaas envia o token diretamente no header 'asaas-access-token' (não é HMAC)
  const expected = Buffer.from(secret.trim());
  const received = Buffer.from(String(signatureHeader || '').trim());

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    logger.warn(
      { sigSample: String(signatureHeader || '').slice(0, 8) },
      'Webhook Asaas: token inválido'
    );
    throw AppError.unauthorized('Assinatura inválida');
  }
}
/**
 * Handles PAYMENT_CONFIRMED and PAYMENT_RECEIVED events.
 * @param {object} payment - payment object from Asaas payload
 */
async function handlePaymentConfirmed(payment) {
  const usuarioId = payment.externalReference;
  const subscriptionId = payment.subscription;

  const assinante = await prisma.assinante.findFirst({
    where: {
      deleted_at: null,
      OR: [
        ...(usuarioId ? [{ usuario_id: usuarioId }] : []),
        ...(subscriptionId
          ? [{ provider_subscription_id: subscriptionId }]
          : []),
      ],
    },
  });

  if (!assinante) {
    logger.warn(
      { usuarioId, subscriptionId },
      'Assinante não encontrado para PAYMENT_CONFIRMED'
    );
    return;
  }

  let proximaCobranca = null;
  if (payment.dueDate) {
    const dueDate = new Date(payment.dueDate);
    if (assinante.ciclo === 'anual') {
      dueDate.setFullYear(dueDate.getFullYear() + 1);
    } else {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
    proximaCobranca = dueDate;
  }

  await atualizarStatusAssinante(assinante.id, assinante.usuario_id, 'ativo', {
    proxima_cobranca: proximaCobranca,
  });
  // Garantir invalidação de cache para o frontend (best-effort)
  try {
    await invalidateBillingCache(assinante.usuario_id);
  } catch (err) {
    logger.warn(
      { err, usuarioId: assinante.usuario_id },
      'Falha ao invalidar cache de billing após PAYMENT_CONFIRMED (continuando)'
    );
  }

  await prisma.assinantePagamento.upsert({
    where: {
      provider_payment: {
        provider: 'asaas',
        provider_payment_id: payment.id,
      },
    },
    create: {
      assinante_id: assinante.id,
      usuario_id: assinante.usuario_id,
      status: 'pago',
      valor: payment.value ?? 0,
      provider: 'asaas',
      provider_payment_id: payment.id,
      descricao: payment.description ?? null,
      data_pagamento: payment.paymentDate
        ? new Date(payment.paymentDate)
        : new Date(),
      data_vencimento: payment.dueDate ? new Date(payment.dueDate) : null,
    },
    update: {
      status: 'pago',
      valor: payment.value ?? 0,
      data_pagamento: payment.paymentDate
        ? new Date(payment.paymentDate)
        : new Date(),
      data_vencimento: payment.dueDate ? new Date(payment.dueDate) : null,
      updated_at: new Date(),
    },
  });

  logger.info(
    { usuarioId: assinante.usuario_id, paymentId: payment.id },
    'Pagamento confirmado'
  );
}

/**
 * Handles PAYMENT_OVERDUE events.
 * @param {object} payment - payment object from Asaas payload
 */
async function handlePaymentOverdue(payment) {
  const usuarioId = payment.externalReference;
  const subscriptionId = payment.subscription;

  const assinante = await prisma.assinante.findFirst({
    where: {
      deleted_at: null,
      OR: [
        ...(usuarioId ? [{ usuario_id: usuarioId }] : []),
        ...(subscriptionId
          ? [{ provider_subscription_id: subscriptionId }]
          : []),
      ],
    },
  });

  if (!assinante) {
    logger.warn(
      { usuarioId, subscriptionId },
      'Assinante não encontrado para PAYMENT_OVERDUE'
    );
    return;
  }

  await atualizarStatusAssinante(
    assinante.id,
    assinante.usuario_id,
    'inadimplente'
  );

  try {
    await invalidateBillingCache(assinante.usuario_id);
  } catch (err) {
    logger.warn(
      { err, usuarioId: assinante.usuario_id },
      'Falha ao invalidar cache de billing após PAYMENT_OVERDUE (continuando)'
    );
  }

  await prisma.assinantePagamento.upsert({
    where: {
      provider_payment: {
        provider: 'asaas',
        provider_payment_id: payment.id,
      },
    },
    create: {
      assinante_id: assinante.id,
      usuario_id: assinante.usuario_id,
      status: 'pendente',
      valor: payment.value ?? 0,
      provider: 'asaas',
      provider_payment_id: payment.id,
      descricao: payment.description ?? null,
      data_vencimento: payment.dueDate ? new Date(payment.dueDate) : null,
    },
    update: {
      status: 'pendente',
      valor: payment.value ?? 0,
      data_vencimento: payment.dueDate ? new Date(payment.dueDate) : null,
      updated_at: new Date(),
    },
  });

  logger.info(
    { usuarioId: assinante.usuario_id, paymentId: payment.id },
    'Pagamento inadimplente'
  );
}

/**
 * Handles SUBSCRIPTION_UPDATED events.
 * Updates assinante fields that may have changed: proxima_cobranca, status.
 * @param {object} subscription - subscription object from Asaas payload
 */
async function handleSubscriptionUpdated(subscription) {
  const usuarioId = subscription.externalReference;
  const subscriptionId = subscription.id;

  const assinante = await prisma.assinante.findFirst({
    where: {
      deleted_at: null,
      OR: [
        ...(usuarioId ? [{ usuario_id: usuarioId }] : []),
        ...(subscriptionId
          ? [{ provider_subscription_id: subscriptionId }]
          : []),
      ],
    },
  });

  if (!assinante) {
    logger.warn(
      { usuarioId, subscriptionId },
      'Assinante não encontrado para SUBSCRIPTION_UPDATED'
    );
    return;
  }

  const proxima_cobranca = subscription.nextDueDate
    ? new Date(subscription.nextDueDate)
    : undefined;
  const novoStatus = mapAsaasStatusToLocal(subscription.status);

  if (!novoStatus && proxima_cobranca === undefined) {
    logger.info(
      { subscriptionId },
      'SUBSCRIPTION_UPDATED sem campos alteráveis'
    );
    return;
  }

  if (novoStatus) {
    await atualizarStatusAssinante(
      assinante.id,
      assinante.usuario_id,
      novoStatus,
      { proxima_cobranca }
    );
  } else {
    await prisma.assinante.update({
      where: { id: assinante.id },
      data: { proxima_cobranca },
    });
  }
  try {
    await invalidateBillingCache(assinante.usuario_id);
  } catch (err) {
    logger.warn(
      { err, usuarioId: assinante.usuario_id },
      'Falha ao invalidar cache de billing após SUBSCRIPTION_UPDATED (continuando)'
    );
  }

  logger.info(
    { usuarioId: assinante.usuario_id, novoStatus, proxima_cobranca },
    'Assinante atualizado por SUBSCRIPTION_UPDATED'
  );
}

/**
 * Handles PAYMENT_DELETED and SUBSCRIPTION_DELETED events.
 * @param {object} payment - payment or subscription object from Asaas payload
 */
async function handleDeleted(payment) {
  const usuarioId = payment.externalReference;
  const subscriptionId = payment.subscription ?? payment.id;

  const assinante = await prisma.assinante.findFirst({
    where: {
      deleted_at: null,
      OR: [
        ...(usuarioId ? [{ usuario_id: usuarioId }] : []),
        ...(subscriptionId
          ? [{ provider_subscription_id: subscriptionId }]
          : []),
      ],
    },
  });

  if (!assinante) {
    logger.warn(
      { usuarioId, subscriptionId },
      'Assinante não encontrado para evento de deleção'
    );
    return;
  }

  await atualizarStatusAssinante(
    assinante.id,
    assinante.usuario_id,
    'cancelado'
  );

  try {
    await invalidateBillingCache(assinante.usuario_id);
  } catch (err) {
    logger.warn(
      { err, usuarioId: assinante.usuario_id },
      'Falha ao invalidar cache de billing após evento de deleção (continuando)'
    );
  }

  logger.info(
    { usuarioId: assinante.usuario_id },
    'Assinatura cancelada por evento de deleção'
  );
}

/**
 * Processes a webhook event from Asaas idempotently.
 *
 * @param {object} payload - parsed JSON payload
 * @param {Buffer|string} rawBody - raw request body for HMAC verification
 * @param {string|undefined} signatureHeader - value of asaas-signature or x-asaas-hmac-sha256 header
 * @returns {Promise<{ processed: boolean, event: string }|{ skipped: boolean }>}
 */
export async function processarWebhookAsaas(payload, rawBody, signatureHeader) {
  // Verify HMAC signature if secret is configured
  if (config.ASAAS_WEBHOOK_SECRET) {
    verificarAssinatura(rawBody, signatureHeader);
  }

  // Idempotency: findFirst + create/update with retry-on-failure support
  const payloadHash = computePayloadHash(payload);

  const existing = await prisma.webhookEvent.findFirst({
    where: {
      provider: 'asaas',
      OR: [{ event_id: String(payload.id) }, { payload_hash: payloadHash }],
    },
  });

  if (existing) {
    if (existing.processado) return { skipped: true }; // already processed successfully
    if (existing.erro === null) return { skipped: true }; // in-flight, avoid concurrent reentry
    // existing.erro != null → previous attempt failed, allow retry: reset error and refresh payload
    await prisma.webhookEvent.update({
      where: { id: existing.id },
      data: { erro: null, payload, payload_hash: payloadHash },
    });
  } else {
    await prisma.webhookEvent.create({
      data: {
        provider: 'asaas',
        event_id: String(payload.id),
        event_type: payload.event ?? 'UNKNOWN',
        payload,
        payload_hash: payloadHash,
        processado: false,
      },
    });
  }

  const eventType = payload.event;
  const payment = payload.payment ?? payload.subscription ?? payload;

  void registrarEvento({
    actorType: 'WEBHOOK',
    eventType: 'webhook',
    eventAction: 'webhook_recebido',
    entityType: 'webhook_event',
    entityId: String(payload.id),
    metadata: {
      provider: 'asaas',
      event_type: eventType,
      event_id: String(payload.id),
    },
    sucesso: true,
  });

  try {
    if (eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_RECEIVED') {
      await handlePaymentConfirmed(payment);
    } else if (eventType === 'PAYMENT_OVERDUE') {
      await handlePaymentOverdue(payment);
    } else if (
      eventType === 'PAYMENT_DELETED' ||
      eventType === 'SUBSCRIPTION_DELETED'
    ) {
      await handleDeleted(payment);
    } else if (eventType === 'SUBSCRIPTION_UPDATED') {
      await handleSubscriptionUpdated(payment);
    } else {
      logger.info({ eventType }, 'Evento Asaas ignorado');
    }

    // Mark as processed
    await prisma.webhookEvent.updateMany({
      where: { provider: 'asaas', event_id: String(payload.id) },
      data: { processado: true, processado_em: new Date() },
    });

    void registrarEvento({
      actorType: 'WEBHOOK',
      eventType: 'webhook',
      eventAction: 'webhook_processado',
      entityType: 'webhook_event',
      entityId: String(payload.id),
      metadata: {
        provider: 'asaas',
        event_type: eventType,
        event_id: String(payload.id),
      },
      sucesso: true,
    });
  } catch (err) {
    logger.error({ err, eventType }, 'Erro ao processar webhook Asaas');
    await prisma.webhookEvent.updateMany({
      where: { provider: 'asaas', event_id: String(payload.id) },
      data: { erro: err?.message ?? 'Erro desconhecido' },
    });

    void registrarEvento({
      actorType: 'WEBHOOK',
      eventType: 'webhook',
      eventAction: 'webhook_falhou',
      entityType: 'webhook_event',
      entityId: String(payload.id),
      metadata: {
        provider: 'asaas',
        event_type: eventType,
        event_id: String(payload.id),
      },
      sucesso: false,
    });

    throw err;
  }

  return { processed: true, event: eventType };
}
