import prisma from '../utils/database.js';
import { asaas } from '../lib/asaas/asaasClient.js';
import logger from '../logger.js';

/**
 * Maps Asaas subscription status to local DB status.
 * @param {string} asaasStatus
 * @returns {string|null} local status or null if no change needed
 */
function mapAsaasStatus(asaasStatus) {
  switch (asaasStatus?.toUpperCase()) {
    case 'ACTIVE':
      return 'ativo';
    case 'INACTIVE':
    case 'CANCELLED':
      return 'cancelado';
    case 'OVERDUE':
      return 'inadimplente';
    default:
      return null;
  }
}

/**
 * Maps Asaas payment status to local DB status.
 * @param {string} asaasPaymentStatus
 * @returns {string}
 */
function mapPaymentStatus(asaasPaymentStatus) {
  switch (asaasPaymentStatus?.toUpperCase()) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return 'pago';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
      return 'estornado';
    case 'CANCELLED':
      return 'cancelado';
    case 'FAILED':
      return 'falhou';
    default:
      return 'pendente';
  }
}

/**
 * Reconciles DB subscriptions with Asaas API.
 * @returns {Promise<{ total: number, sincronizados: number, erros: Array<{ id: string, erro: string }> }>}
 */
export async function executarReconciliacao() {
  logger.info({ msg: 'Iniciando reconciliação Asaas' });

  const assinantes = await prisma.assinante.findMany({
    where: {
      status: { in: ['ativo', 'inadimplente', 'pendente'] },
      provider: 'asaas',
      provider_subscription_id: { not: null },
      deleted_at: null,
    },
  });

  const total = assinantes.length;
  let sincronizados = 0;
  const erros = [];

  for (const assinante of assinantes) {
    try {
      const subscricaoAsaas = await asaas.getSubscription(assinante.provider_subscription_id);
      const statusAsaas = subscricaoAsaas.status;
      const novoStatus = mapAsaasStatus(statusAsaas);

      let dbUpdates = {};

      // Reconcile status
      if (novoStatus && novoStatus !== assinante.status) {
        dbUpdates.status = novoStatus;

        if (novoStatus === 'cancelado' && assinante.status === 'ativo') {
          logger.info({ msg: 'Reconciliação: marcando assinante como cancelado', assinanteId: assinante.id });
        } else if (novoStatus === 'ativo' && assinante.status === 'inadimplente') {
          logger.info({ msg: 'Reconciliação: restaurando assinante para ativo', assinanteId: assinante.id });
        } else if (novoStatus === 'inadimplente' && assinante.status === 'ativo') {
          logger.info({ msg: 'Reconciliação: marcando assinante como inadimplente', assinanteId: assinante.id });
        }
      }

      if (Object.keys(dbUpdates).length > 0) {
        dbUpdates.updated_at = new Date();

        await prisma.$transaction(async (tx) => {
          await tx.assinante.update({
            where: { id: assinante.id },
            data: dbUpdates,
          });

          // Sync user status based on subscription status
          if (dbUpdates.status === 'inadimplente') {
            await tx.usuario.update({
              where: { id: assinante.usuario_id },
              data: { status: 'bloqueado_inadimplencia', updated_at: new Date() },
            });
          } else if (dbUpdates.status === 'ativo') {
            await tx.usuario.update({
              where: { id: assinante.usuario_id },
              data: { status: 'ativo', updated_at: new Date() },
            });
          }
        });
      }

      // Sync payments
      const pagamentos = await asaas.listPaymentsBySubscription(assinante.provider_subscription_id);

      for (const pagamento of pagamentos) {
        if (!pagamento.id) continue;

        const existingPagamento = await prisma.assinantePagamento.findFirst({
          where: { provider_payment_id: pagamento.id },
        });

        if (existingPagamento) {
          await prisma.assinantePagamento.update({
            where: { id: existingPagamento.id },
            data: {
              status: mapPaymentStatus(pagamento.status),
              valor: pagamento.value || 0,
              data_pagamento: pagamento.paymentDate ? new Date(pagamento.paymentDate) : null,
              data_vencimento: pagamento.dueDate ? new Date(pagamento.dueDate) : null,
              updated_at: new Date(),
            },
          });
        } else {
          await prisma.assinantePagamento.create({
            data: {
              assinante_id: assinante.id,
              usuario_id: assinante.usuario_id,
              status: mapPaymentStatus(pagamento.status),
              valor: pagamento.value || 0,
              provider: 'asaas',
              provider_payment_id: pagamento.id,
              descricao: pagamento.description || null,
              data_pagamento: pagamento.paymentDate ? new Date(pagamento.paymentDate) : null,
              data_vencimento: pagamento.dueDate ? new Date(pagamento.dueDate) : null,
            },
          });
        }
      }

      sincronizados++;
    } catch (err) {
      logger.error({ msg: 'Erro ao reconciliar assinante', assinanteId: assinante.id, err: err.message });
      erros.push({ id: assinante.id, erro: err.message });
    }
  }

  const sumario = { total, sincronizados, erros };
  logger.info({ msg: 'Reconciliação concluída', ...sumario });

  return sumario;
}
