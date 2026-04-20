import prisma from '../utils/database.js';
import logger from '../logger.js';
import { getRedisClient } from '../utils/redisClient.js';
import { registrarEvento } from './auditoria.service.js';

const BILLING_STATUS_CACHE_PREFIX = 'billing:status:';

// Helper para invalidar cache de billing com logs (não lança erro)
export async function invalidateBillingCache(usuarioId) {
  const key = `${BILLING_STATUS_CACHE_PREFIX}${usuarioId}`;
  try {
    const redis = await getRedisClient();
    const removed = await redis.del(key);
    logger.info({ usuarioId, key, removed }, 'Tentativa de invalidar cache de billing');
  } catch (err) {
    logger.error({ err, usuarioId, key }, 'Erro ao invalidar cache de billing (continuando)');
    // não propaga o erro - falha no cache não deve interromper fluxo de billing
  }
}

/**
 * Maps assinante status to the corresponding usuario status.
 *
 * Regras do documento técnico v1.0:
 *   - ativo        → ativo              (acesso liberado)
 *   - trial        → ativo              (acesso liberado)
 *   - pendente     → pendente_pagamento (sem acesso — aguardando pagamento)
 *   - inadimplente → bloqueado_inadimplencia (sem acesso)
 *   - cancelado    → pendente_pagamento (sem acesso — sem assinatura ativa)
 *   - inativo      → pendente_pagamento (sem acesso — sem assinatura ativa)
 *   - default      → pendente_pagamento (sem acesso)
 *
 * @param {string} assinanteStatus
 * @returns {string} usuarioStatus
 */
function toUsuarioStatus(assinanteStatus) {
  switch (assinanteStatus) {
    case 'ativo':
    case 'trial':
      return 'ativo';
    case 'pendente':
      return 'pendente_pagamento';
    case 'inadimplente':
      return 'bloqueado_inadimplencia';
    case 'cancelado':
    case 'inativo':
      // Permitir login, porém com acesso restrito às funcionalidades pagas
      return 'ativo_restrito';
    default:
      return 'ativo_restrito';
  }
}

/**
 * Updates the assinante status and cascades the corresponding usuario status.
 * Optionally accepts a Prisma transaction client.
 *
 * @param {string} assinanteId - UUID of the Assinante record
 * @param {string} usuarioId - UUID of the Usuario record (for cascade update)
 * @param {string} novoStatus - One of: trial | pendente | ativo | inativo | cancelado | inadimplente
 * @param {{ tx?: import('@prisma/client').PrismaClient, proxima_cobranca?: Date | null }} [opts]
 * @returns {Promise<void>}
 */
export async function atualizarStatusAssinante(assinanteId, usuarioId, novoStatus, opts = {}) {
  const { tx, proxima_cobranca } = opts;
  const db = tx ?? prisma;

  // Capture the current status before the update for audit purposes
  const current = await db.assinante.findUnique({
    where: { id: assinanteId },
    select: { status: true },
  });
  const statusAnterior = current?.status ?? null;

  const assinanteData = { status: novoStatus, updated_at: new Date() };
  if (proxima_cobranca !== undefined) {
    assinanteData.proxima_cobranca = proxima_cobranca;
  }

  await db.assinante.update({
    where: { id: assinanteId },
    data: assinanteData,
  });

  const novoStatusUsuario = toUsuarioStatus(novoStatus);

  await db.usuario.update({
    where: { id: usuarioId },
    data: { status: novoStatusUsuario },
  });

  logger.info(
    { assinanteId, usuarioId, novoStatus, novoStatusUsuario },
    'Status do assinante atualizado',
  );

  registrarEvento({
    usuarioId,
    actorType: 'SYSTEM',
    eventType: 'billing',
    eventAction: 'assinante_status_atualizado',
    entityType: 'assinante',
    entityId: assinanteId,
    metadata: { status_anterior: statusAnterior, novo_status: novoStatus },
    sucesso: true,
  });

  // Invalidate billing status cache (best-effort) via helper
  await invalidateBillingCache(usuarioId);
}

/**
 * Maps an Asaas subscription status string to the local assinante status.
 * Returns null for unrecognized/unhandled statuses.
 *
 * @param {string} asaasStatus
 * @returns {string|null}
 */
export function mapAsaasStatusToLocal(asaasStatus) {
  switch (asaasStatus) {
    case 'ACTIVE':
      return 'ativo';
    case 'PENDING':
      return 'pendente';
    case 'OVERDUE':
      return 'inadimplente';
    case 'INACTIVE':
    case 'CANCELLED':
      return 'cancelado';
    default:
      return null;
  }
}
