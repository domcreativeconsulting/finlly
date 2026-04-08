import prisma from '../utils/database.js';
import logger from '../logger.js';

/**
 * Registra um evento de auditoria no banco de dados.
 *
 * Função não-bloqueante: erros são registrados no log sem quebrar a requisição.
 *
 * @param {{ usuarioId?: string, tipo: string, detalhes?: object, ip?: string, userAgent?: string, sucesso?: boolean }} params
 */
export async function registrarEvento({ usuarioId, tipo, detalhes, ip, userAgent, sucesso = true }) {
  try {
    await prisma.auditoriaEvento.create({
      data: {
        usuario_id: usuarioId || null,
        tipo,
        detalhes: detalhes || null,
        ip_address: ip ? String(ip).slice(0, 45) : null,
        user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
        sucesso,
      },
    });
  } catch (err) {
    logger.error({ msg: 'Falha ao registrar evento de auditoria', tipo, usuarioId, err: err.message });
  }
}
