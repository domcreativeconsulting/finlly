import { config } from '../../config/env.js';
import { AppError } from '../../errors/AppError.js';
import logger from '../../logger.js';

/**
 * Sends a text message to the given WhatsApp number via the Evolution API.
 *
 * @param {string} number - Destination phone number (digits only, e.g. "5511999999999")
 * @param {string} text   - Message text to send
 * @returns {Promise<object>} Response body from Evolution API
 * @throws {AppError} On missing configuration or HTTP/network error
 */
export async function sendText(number, text) {
  const baseUrl = config.EVOLUTION_API_URL;
  const apiKey = config.EVOLUTION_API_KEY;
  const instance = config.EVOLUTION_INSTANCE;

  if (!baseUrl || !apiKey || !instance) {
    throw AppError.internal('Evolution API não configurada (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE)');
  }

  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({ number, text }),
    });
  } catch (err) {
    logger.error({ err, url, number }, 'Erro de rede ao enviar mensagem via Evolution API');
    throw AppError.internal('Erro de conexão com a Evolution API');
  }

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // ignore parse errors
    }
    logger.error({ status: response.status, body, url, number }, 'Evolution API retornou erro HTTP');
    throw AppError.internal(`Erro ao enviar mensagem via Evolution API: ${response.status}`);
  }

  return response.json();
}

export const evolutionClient = { sendText };
export default evolutionClient;
