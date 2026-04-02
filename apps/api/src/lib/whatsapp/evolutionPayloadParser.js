/**
 * Evolution API payload normalization utilities.
 *
 * Provides a single, reusable layer that converts the raw Evolution webhook
 * payload into a stable internal structure (`NormalizedMessage`) consumed by
 * the entire WhatsApp agent pipeline.
 *
 * @module evolutionPayloadParser
 */

// ============================================================
// Phone number normalization
// ============================================================

/**
 * Strips all non-digit characters from a phone-number string.
 * Converts any format to digits-only (E.164 without the leading `+`).
 *
 * @param {string|null|undefined} raw - Raw phone number in any format
 * @returns {string} Digits-only string, or '' for null/undefined input
 */
export function normalizePhoneNumber(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

// ============================================================
// Message-type detection helper
// ============================================================

/**
 * @param {object|null|undefined} message - data.message from the payload
 * @returns {'TEXT'|'IMAGE'|'AUDIO'|'DOCUMENT'|'STICKER'|'UNKNOWN'}
 */
function detectMessageType(message) {
  if (!message) return 'UNKNOWN';
  if (message.conversation !== undefined || message.extendedTextMessage?.text !== undefined) {
    return 'TEXT';
  }
  if (message.imageMessage !== undefined) return 'IMAGE';
  if (message.audioMessage !== undefined) return 'AUDIO';
  if (message.documentMessage !== undefined) return 'DOCUMENT';
  if (message.stickerMessage !== undefined) return 'STICKER';
  return 'UNKNOWN';
}

// ============================================================
// Payload normalization
// ============================================================

/**
 * @typedef {Object} NormalizedMessage
 * @property {'EVOLUTION'}                                      provider          - Always 'EVOLUTION'
 * @property {string|null}                                      providerMessageId - data.key.id
 * @property {string|null}                                      instanceName      - payload.instance
 * @property {string}                                           phoneRaw          - remoteJid stripped of @suffix
 * @property {string}                                           phoneNormalized   - digits-only phoneRaw
 * @property {boolean}                                          fromMe            - data.key.fromMe
 * @property {string|null}                                      contactName       - data.pushName
 * @property {'INBOUND'}                                        direction         - Always 'INBOUND' on incoming webhook
 * @property {'TEXT'|'IMAGE'|'AUDIO'|'DOCUMENT'|'STICKER'|'UNKNOWN'} messageType
 * @property {string}                                           messageText       - Trimmed text content or ''
 * @property {Date|null}                                        eventTimestamp    - data.messageTimestamp * 1000 as Date
 * @property {string}                                           payloadRaw        - JSON.stringify(payload)
 */

/**
 * Converts a validated Evolution API webhook payload into the standard
 * internal `NormalizedMessage` structure.
 *
 * Tolerant of partially missing fields: absent values produce safe defaults
 * (empty strings, null, false) without throwing exceptions.
 *
 * @param {object} payload - Validated Evolution webhook payload
 * @returns {NormalizedMessage}
 */
export function normalizeEvolutionPayload(payload) {
  const data = payload?.data ?? {};
  const key = data?.key ?? {};
  const message = data?.message ?? null;

  // Strip the @s.whatsapp.net (or similar) suffix from remoteJid
  const remoteJid = key?.remoteJid ?? '';
  const phoneRaw = remoteJid ? remoteJid.replace(/@.*$/, '') : '';
  const phoneNormalized = normalizePhoneNumber(phoneRaw);

  const messageType = detectMessageType(message);
  const messageText =
    messageType === 'TEXT'
      ? (message?.conversation ?? message?.extendedTextMessage?.text ?? '').trim()
      : '';

  return {
    provider: 'EVOLUTION',
    providerMessageId: key?.id ?? null,
    instanceName: payload?.instance ?? null,
    phoneRaw,
    phoneNormalized,
    fromMe: key?.fromMe ?? false,
    contactName: data?.pushName ?? null,
    direction: 'INBOUND',
    messageType,
    messageText,
    eventTimestamp: data?.messageTimestamp ? new Date(data.messageTimestamp * 1000) : null,
    payloadRaw: JSON.stringify(payload),
  };
}
