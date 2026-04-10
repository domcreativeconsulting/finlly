import prisma from '../utils/database.js';
import logger from '../logger.js';
import { getRedisClient } from '../utils/redisClient.js';
import { registrarEvento } from './auditoria.service.js';

const BILLING_STATUS_CACHE_PREFIX = 'billing:status:';

/**
 * Maps assinante status to the corresponding usuario status.
 * @param {string} assinanteStatus
 * @returns {string} usuarioStatus
 */
function toUsuarioStatus(assinanteStatus) {
  switch (assinanteStatus) {
    case 'ativo':
      return 'ativo';
    case 'pendente':
      return 'ativo'; // Pendente ainda não bloqueia o usuário
    case 'inadimplente':
      return 'bloqueado_inadimplencia';
    case 'cancelado':
    case 'inativo':
    case 'trial':
    default:
      return 'ativo';
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

  // Invalidate billing status cache (best-effort)
  try {
    const redis = await getRedisClient();
    await redis.del(`${BILLING_STATUS_CACHE_PREFIX}${usuarioId}`);
  } catch {
    // Redis unavailable — ignore
  }
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
