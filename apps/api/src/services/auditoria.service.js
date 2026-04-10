import prisma from '../utils/database.js';
import logger from '../logger.js';

/**
 * Registra um evento de auditoria no banco de dados.
 *
 * Função não-bloqueante: erros são registrados no log sem quebrar a requisição.
 *
 * Aceita tanto a assinatura legada ({ tipo, detalhes }) quanto a nova
 * ({ actorType, eventType, eventAction, entityType, entityId, requestId, metadata }).
 *
 * @param {{
 *   usuarioId?: string,
 *   actorType?: string,
 *   tipo?: string,
 *   eventType?: string,
 *   eventAction?: string,
 *   entityType?: string,
 *   entityId?: string,
 *   requestId?: string,
 *   detalhes?: object,
 *   metadata?: object,
 *   ip?: string,
 *   userAgent?: string,
 *   sucesso?: boolean
 * }} params
 */
export async function registrarEvento({
  usuarioId,
  actorType,
  tipo,
  eventType,
  eventAction,
  entityType,
  entityId,
  requestId,
  detalhes,
  metadata,
  ip,
  userAgent,
  sucesso = true,
}) {
  try {
    await prisma.auditoriaEvento.create({
      data: {
        usuario_id: usuarioId || null,
        actor_type: actorType ? String(actorType).slice(0, 50) : null,
        tipo: tipo ? String(tipo).slice(0, 100) : null,
        event_type: eventType ? String(eventType).slice(0, 100) : null,
        event_action: eventAction ? String(eventAction).slice(0, 100) : null,
        entity_type: entityType ? String(entityType).slice(0, 100) : null,
        entity_id: entityId ? String(entityId).slice(0, 255) : null,
        request_id: requestId ? String(requestId).slice(0, 255) : null,
        detalhes: detalhes || null,
        metadata: metadata || null,
        ip_address: ip ? String(ip).slice(0, 45) : null,
        user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
        sucesso,
      },
    });
  } catch (err) {
    logger.error({ msg: 'Falha ao registrar evento de auditoria', eventType: eventType || tipo, usuarioId, err: err.message });
  }
}
