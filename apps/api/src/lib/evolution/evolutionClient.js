import { config } from '../../config/env.js';
import { AppError } from '../../errors/AppError.js';
import logger from '../../logger.js';

const RETRY_BASE_DELAY_MS = 500;
const RETRY_JITTER_MS = 200;
const RETRY_MAX_DELAY_MS = 10000;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 422]);

/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a text message to the given WhatsApp number via the Evolution API with
 * automatic retry (exponential backoff + jitter) and per-attempt timeout.
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
  const headers = {
    'Content-Type': 'application/json',
    apikey: apiKey,
  };

  const maxRetries = config.EVOLUTION_MAX_RETRIES;
  const timeoutMs = config.EVOLUTION_TIMEOUT_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number, text }),
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err.name === 'AbortError' || err.name === 'TimeoutError';
      const isNetwork = err instanceof TypeError;
      if (isAbort || isNetwork) {
        logger.warn({ err, url, attempt }, 'Evolution request failed (retriable)');
        if (attempt < maxRetries) {
          const delay = Math.min(
            RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * RETRY_JITTER_MS,
            RETRY_MAX_DELAY_MS
          );
          await sleep(delay);
          continue;
        }
        logger.error({ err, url }, 'Evolution request exhausted retries');
        throw AppError.internal('Erro de conexão com a Evolution API');
      }
      logger.error({ err, url }, 'Evolution network error');
      throw AppError.internal('Erro de conexão com a Evolution API');
    } finally {
      clearTimeout(timer);
    }

    if (NON_RETRYABLE_STATUSES.has(response.status)) {
      let body = null;
      try {
        body = await response.json();
      } catch {
        // ignore parse errors
      }
      logger.error({ status: response.status, body, url, number }, 'Evolution HTTP error');
      throw AppError.internal(`Erro ao enviar mensagem via Evolution API: ${response.status}`);
    }

    if (RETRYABLE_STATUSES.has(response.status)) {
      let retryAfterMs = null;
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          retryAfterMs = parseFloat(retryAfter) * 1000;
        }
      }
      logger.warn({ status: response.status, url, attempt }, 'Evolution request failed (retriable)');
      if (attempt < maxRetries) {
        const delay = retryAfterMs !== null
          ? retryAfterMs
          : Math.min(
              RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * RETRY_JITTER_MS,
              RETRY_MAX_DELAY_MS
            );
        await sleep(delay);
        continue;
      }
      logger.error({ status: response.status, url }, 'Evolution request exhausted retries');
      throw AppError.internal(`Erro ao enviar mensagem via Evolution API: ${response.status}`);
    }

    return response.json();
  }
}

export const evolutionClient = { sendText };
export default evolutionClient;
