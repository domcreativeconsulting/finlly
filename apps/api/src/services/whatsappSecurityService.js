/**
 * WhatsApp Security Service — Rate limiting, audit logging, and user validation.
 *
 * Provides in-memory rate limiting per phone number, WhatsappLog persistence,
 * and active-user validation. All helpers are designed to be non-breaking:
 * errors in `registrarLogWhatsapp` are swallowed and logged without affecting
 * the main webhook flow.
 *
 * @module whatsappSecurityService
 */

import prisma from '../utils/database.js';
import logger from '../logger.js';

// ============================================================
// Rate limit — in-memory, per phone number
// ============================================================

/** @type {Map<string, { count: number, windowStart: number }>} */
const rateLimitStore = new Map();

/** Maximum messages allowed per rate-limit window */
const RATE_LIMIT_MAX = 20;

/** Rate-limit window duration in milliseconds (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * Checks whether the given phone number is within the rate limit.
 * Uses a fixed time window (sliding reset): the counter resets when the
 * window expires. Returns `true` when the message is allowed, `false`
 * when the number has exceeded 20 messages in the last minute.
 *
 * @param {string} telefone - Normalised phone number (digits only)
 * @returns {boolean} `true` if allowed, `false` if blocked
 */
export function checkRateLimitPorNumero(telefone) {
  const now = Date.now();
  const entry = rateLimitStore.get(telefone);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(telefone, { count: 1, windowStart: now });
    return true; // first message in new window — allowed
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) return false; // blocked

  return true;
}

// ============================================================
// Audit logging
// ============================================================

/**
 * Persists a WhatsApp interaction log entry to the database.
 * Fire-and-forget: errors are logged but never re-thrown so they cannot
 * break the main webhook processing flow.
 *
 * @param {object}  opts
 * @param {string|null|undefined} opts.usuario_id  - UUID of the Finlly user (nullable)
 * @param {string}  opts.telefone                  - Phone number (digits only)
 * @param {string}  opts.direcao                   - 'entrada' | 'saida'
 * @param {string|null|undefined} opts.conteudo    - Message text (nullable)
 * @param {string}  [opts.status='processado']     - Log status label
 * @returns {Promise<void>}
 */
export async function registrarLogWhatsapp({
  usuario_id,
  telefone,
  direcao,
  conteudo,
  status = 'processado',
}) {
  try {
    await prisma.whatsappLog.create({
      data: {
        usuario_id: usuario_id ?? null,
        provider: 'evolution',
        telefone,
        direcao,
        tipo_mensagem: 'text',
        conteudo: conteudo ?? null,
        status,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  } catch (err) {
    logger.error({ err, telefone, direcao }, 'Falha ao registrar log WhatsApp');
  }
}

// ============================================================
// User validation
// ============================================================

/**
 * Validates that the given user account is active.
 *
 * @param {object|null|undefined} usuario - Resolved usuario object (or null)
 * @returns {{ valido: boolean, mensagem: string|null }}
 */
export function validarUsuarioAtivo(usuario) {
  if (!usuario || usuario.status !== 'ativo') {
    return {
      valido: false,
      mensagem: '⛔ Sua conta está suspensa. Entre em contato com o suporte.',
    };
  }
  return { valido: true, mensagem: null };
}
