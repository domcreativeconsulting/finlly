import prisma from '../utils/database.js';
import logger from '../logger.js';

// Field length limits matching the database schema constraints
const MAX_ACTOR_TYPE_LENGTH = 50;
const MAX_TYPE_LENGTH = 100;
const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_EVENT_ACTION_LENGTH = 100;
const MAX_ENTITY_TYPE_LENGTH = 100;
const MAX_ENTITY_ID_LENGTH = 255;
const MAX_REQUEST_ID_LENGTH = 255;
const MAX_IP_ADDRESS_LENGTH = 45;
const MAX_USER_AGENT_LENGTH = 512;

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
        actor_type: actorType ? String(actorType).slice(0, MAX_ACTOR_TYPE_LENGTH) : null,
        tipo: tipo ? String(tipo).slice(0, MAX_TYPE_LENGTH) : null,
        event_type: eventType ? String(eventType).slice(0, MAX_EVENT_TYPE_LENGTH) : null,
        event_action: eventAction ? String(eventAction).slice(0, MAX_EVENT_ACTION_LENGTH) : null,
        entity_type: entityType ? String(entityType).slice(0, MAX_ENTITY_TYPE_LENGTH) : null,
        entity_id: entityId ? String(entityId).slice(0, MAX_ENTITY_ID_LENGTH) : null,
        request_id: requestId ? String(requestId).slice(0, MAX_REQUEST_ID_LENGTH) : null,
        detalhes: detalhes || null,
        metadata: metadata || null,
        ip_address: ip ? String(ip).slice(0, MAX_IP_ADDRESS_LENGTH) : null,
        user_agent: userAgent ? String(userAgent).slice(0, MAX_USER_AGENT_LENGTH) : null,
        sucesso,
      },
    });
  } catch (err) {
    logger.error({ msg: 'Falha ao registrar evento de auditoria', eventType: eventType || tipo, usuarioId, err: err.message });
  }
}
