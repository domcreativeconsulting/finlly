/**
 * WhatsApp Sender Service — Outbound message sending via Evolution API.
 *
 * Provides a single, reusable interface for sending text messages to WhatsApp
 * users through the Evolution API. Persists an outbound log entry for every
 * send attempt (success or failure) via whatsappSecurityService.
 *
 * Credentials (API key, token) are never included in logs or stored payloads.
 *
 * @module whatsappSenderService
 */

import { sendText } from '../lib/evolution/evolutionClient.js';
import { normalizePhoneNumber } from '../lib/whatsapp/evolutionPayloadParser.js';
import { registrarLogWhatsapp } from './whatsappSecurityService.js';
import { config } from '../config/env.js';
import logger from '../logger.js';

/**
 * Sends a text message to the given WhatsApp number via Evolution API.
 * Persists an OUTBOUND log entry regardless of success or failure.
 *
 * @param {object} opts
 * @param {string}      opts.telefone    - Destination phone number (will be normalized)
 * @param {string}      opts.texto       - Message text (must not be empty)
 * @param {string|null} [opts.usuarioId] - Finlly user UUID (nullable)
 * @param {object}      [opts._context]  - Optional context for logging { requestId, intent }
 * @returns {Promise<{ success: boolean, providerMessageId: string|null, status: 'enviado'|'falha', erro: string|null }>}  
 */
export async function sendTextMessage({ telefone, texto, usuarioId = null, _context = {} }) {
  // Validate that message text is not empty — return immediately without log
  if (!texto || !texto.trim()) {
    return { success: false, status: 'falha', providerMessageId: null, erro: 'Mensagem vazia' };
  }

  const telefoneNormalizado = normalizePhoneNumber(telefone);

  let providerMessageId = null;
  let status = 'enviado';
  let erro = null;

  try {
    const result = await sendText(telefoneNormalizado, texto);
    providerMessageId = result?.key?.id ?? null;
    logger.info(
      { telefone: telefoneNormalizado, providerMessageId, status },
      'Mensagem WhatsApp enviada com sucesso',
    );
  } catch (err) {
    status = 'falha';
    erro = err?.message ?? 'Erro desconhecido ao enviar mensagem';
    // Log only sanitized info — never log tokens or credentials
    logger.error({ telefone: telefoneNormalizado, status }, 'Falha ao enviar mensagem WhatsApp');
  }

  // Persist outbound log — fire-and-forget: errors are swallowed by registrarLogWhatsapp
  // payload_raw contains only the request body (no auth headers)
  await registrarLogWhatsapp({
    usuario_id: usuarioId,
    telefone: telefoneNormalizado,
    direcao: 'saida',
    tipo_mensagem: 'text',
    conteudo: texto,
    status,
    provider_message_id: providerMessageId,
    payload_raw: JSON.stringify({ number: telefoneNormalizado, text: texto }),
    instance_name: config.EVOLUTION_INSTANCE ?? null,
  });

  return {
    success: status === 'enviado',
    providerMessageId,
    status,
    erro,
  };
}