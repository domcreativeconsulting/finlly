import prisma from '../utils/database.js';
import { asaas } from '../lib/asaas/asaasClient.js';
import { getRedisClient } from '../utils/redisClient.js';
import logger from '../logger.js';

const LOCK_KEY = 'reconciliacao:lock';
const LOCK_TTL = 300; // 300 seconds

/**
 * Maps Asaas subscription status to local status.
 * @param {string} asaasStatus
 * @returns {{ assinanteStatus: string, usuarioStatus: string }}
 */
function mapAsaasStatus(asaasStatus) {
  switch (asaasStatus) {
    case 'ACTIVE':
      return { assinanteStatus: 'ativo', usuarioStatus: 'ativo' };
    case 'OVERDUE':
      return { assinanteStatus: 'inadimplente', usuarioStatus: 'bloqueado_inadimplencia' };
    case 'INACTIVE':
    case 'CANCELLED':
      return { assinanteStatus: 'cancelado', usuarioStatus: 'ativo' };
    default:
      return null;
  }
}

/**
 * Maps Asaas payment status to local status.
 * @param {string} asaasPaymentStatus
 * @returns {string}
 */
function mapPaymentStatus(asaasPaymentStatus) {
  switch (asaasPaymentStatus) {
    case 'CONFIRMED':
    case 'RECEIVED':
      return 'pago';
    case 'PENDING':
      return 'pendente';
    case 'OVERDUE':
      return 'pendente';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
      return 'estornado';
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
    case 'AWAITING_CHARGEBACK_REVERSAL':
      return 'estornado';
    case 'DUNNING_REQUESTED':
    case 'DUNNING_RECEIVED':
    case 'AWAITING_RISK_ANALYSIS':
      return 'pendente';
    default:
      return 'pendente';
  }
}

/**
 * Reconciles subscriptions and payments from Asaas against the local database.
 * Uses a distributed Redis lock to prevent concurrent execution.
 *
 * @returns {Promise<{ skipped: true }|{ total: number, atualizados: number, erros: number }>}
 */
export async function reconciliarAssinaturas() {
  const redis = await getRedisClient();

  // Acquire distributed lock
  const acquired = await redis.set(LOCK_KEY, '1', { NX: true, EX: LOCK_TTL });
  if (!acquired) {
    logger.warn({ msg: 'Reconciliação já em execução (lock ativo). Pulando.' });
    return { skipped: true };
  }

  let total = 0;
  let atualizados = 0;
  let erros = 0;

  try {
    const assinantes = await prisma.assinante.findMany({
      where: {
        status: { in: ['ativo', 'inadimplente'] },
        provider_subscription_id: { not: null },
        deleted_at: null,
      },
    });

    total = assinantes.length;

    for (const assinante of assinantes) {
      try {
        const subscriptionData = await asaas.getSubscription(assinante.provider_subscription_id);

        const mapped = mapAsaasStatus(subscriptionData.status);
        if (mapped) {
          const { assinanteStatus, usuarioStatus } = mapped;

          // Update assinante status if changed
          if (assinante.status !== assinanteStatus) {
            await prisma.assinante.update({
              where: { id: assinante.id },
              data: { status: assinanteStatus, updated_at: new Date() },
            });
          }

          // Update usuario status based on assinante status
          await prisma.usuario.update({
            where: { id: assinante.usuario_id },
            data: { status: usuarioStatus },
          });

          logger.info(
            {
              assinanteId: assinante.id,
              usuarioId: assinante.usuario_id,
              asaasStatus: subscriptionData.status,
              localStatus: assinanteStatus,
            },
            'Assinante sincronizado',
          );
        }

        // Sync payments
        const paymentsData = await asaas.getPaymentsBySubscription(assinante.provider_subscription_id);
        const payments = paymentsData?.data ?? [];

        for (const payment of payments) {
          if (!payment.id) continue;

          const paymentStatus = mapPaymentStatus(payment.status);

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
              status: paymentStatus,
              valor: payment.value ?? 0,
              provider: 'asaas',
              provider_payment_id: payment.id,
              descricao: payment.description ?? null,
              data_pagamento: payment.paymentDate ? new Date(payment.paymentDate) : null,
              data_vencimento: payment.dueDate ? new Date(payment.dueDate) : null,
            },
            update: {
              status: paymentStatus,
              valor: payment.value ?? 0,
              data_pagamento: payment.paymentDate ? new Date(payment.paymentDate) : undefined,
              data_vencimento: payment.dueDate ? new Date(payment.dueDate) : undefined,
              updated_at: new Date(),
            },
          });
        }

        atualizados++;
      } catch (err) {
        erros++;
        logger.error(
          { err, assinanteId: assinante.id, subscriptionId: assinante.provider_subscription_id },
          'Erro ao reconciliar assinante',
        );
      }
    }

    logger.info({ total, atualizados, erros }, 'Reconciliação concluída');
    return { total, atualizados, erros };
  } finally {
    try {
      await redis.del(LOCK_KEY);
    } catch (err) {
      logger.error({ err }, 'Erro ao liberar lock de reconciliação');
    }
  }
}
