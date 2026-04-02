import { sendText } from '../lib/evolution/evolutionClient.js';
import logger from '../logger.js';

/**
 * Processes an incoming WhatsApp webhook payload from the Evolution API.
 *
 * Logs the received message and forwards it for further processing.
 * Currently returns a structured representation of the message.
 *
 * @param {object} payload - Parsed webhook payload from Evolution API
 * @returns {{ from: string, name: string, text: string, fromMe: boolean }}
 */
export function processarMensagemRecebida(payload) {
  const { data } = payload;
  const from = data.key.remoteJid.replace(/@.*$/, '');
  const fromMe = data.key.fromMe ?? false;
  const name = data.pushName ?? from;
  const text = data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? '';

  logger.info({ from, name, fromMe, text }, 'Mensagem WhatsApp recebida');

  return { from, name, text, fromMe };
}

/**
 * Sends a text message to the given WhatsApp number via the Evolution API.
 *
 * @param {string} number - Destination phone number (digits only, e.g. "5511999999999")
 * @param {string} text   - Message text to send
 * @returns {Promise<object>} Response from Evolution API
 */
export async function enviarMensagem(number, text) {
  logger.info({ number, text }, 'Enviando mensagem WhatsApp');
  try {
    const result = await sendText(number, text);
    logger.info({ number, result }, 'Mensagem WhatsApp enviada com sucesso');
    return result;
  } catch (err) {
    logger.error({ err, number }, 'Falha ao enviar mensagem WhatsApp');
    throw err;
  }
}
