import { config } from '../../config/env.js';
import { AppError } from '../../errors/AppError.js';
import logger from '../../logger.js';

const RETRY_BASE_DELAY_MS = 500;
const RETRY_JITTER_MS = 200;
const RETRY_MAX_DELAY_MS = 10_000;

/**
 * Returns the Asaas base URL from config or derives it from ASAAS_ENV.
 * @returns {string}
 */
function getBaseUrl() {
  if (config.ASAAS_BASE_URL) return config.ASAAS_BASE_URL;
  return config.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

/**
 * Resolves after the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates the retry delay using exponential backoff + jitter, or a
 * server-specified Retry-After value when provided.
 * @param {number} attempt - zero-indexed attempt number
 * @param {number|null} [retryAfterMs] - delay from Retry-After header in ms
 * @returns {number} delay in milliseconds
 */
function calculateRetryDelay(attempt, retryAfterMs = null) {
  if (retryAfterMs != null) return retryAfterMs;
  return Math.min(
    RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * RETRY_JITTER_MS,
    RETRY_MAX_DELAY_MS,
  );
}

/**
 * Performs an authenticated HTTP request to the Asaas API with automatic
 * retries (exponential backoff + jitter) and per-attempt timeouts.
 * @param {string} path - API path (e.g. '/customers')
 * @param {RequestInit} [options] - fetch options
 * @returns {Promise<object|null>}
 */
async function request(path, options = {}) {
  const url = `${getBaseUrl()}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    access_token: config.ASAAS_API_KEY ?? '',
    ...options.headers,
  };

  const maxAttempts = (config.ASAAS_MAX_RETRIES ?? 3) + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.ASAAS_TIMEOUT_MS ?? 10000);

    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeoutId);

      // 204 No Content
      if (response.status === 204) return null;

      // Non-retriable 4xx (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        let body = null;
        try {
          body = await response.json();
        } catch {
          // ignore parse errors
        }
        logger.error({ status: response.status, body, url }, 'Asaas HTTP error');
        throw AppError.internal(`Erro no provedor de pagamento: ${response.status}`);
      }

      // Retriable HTTP errors (429, 5xx)
      if (!response.ok) {
        let retryAfterMs = null;
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) retryAfterMs = parseFloat(retryAfter) * 1000;
        }

        logger.warn(
          { url, attempt: attempt + 1, totalAttempts: maxAttempts, status: response.status },
          'Asaas request falhou, tentando novamente...',
        );

        if (attempt < maxAttempts - 1) {
          await sleep(calculateRetryDelay(attempt, retryAfterMs));
        }
        continue;
      }

      // Success
      return response.json();
    } catch (err) {
      clearTimeout(timeoutId);

      // Non-retriable errors thrown above bubble up immediately
      if (err instanceof AppError || err?.name === 'AppError') throw err;

      const isTimeout = err?.name === 'AbortError' || err?.name === 'TimeoutError';
      const isNetwork = err instanceof TypeError;

      if (!isTimeout && !isNetwork) throw AppError.internal('Erro de conexão com o provedor de pagamento');

      logger.warn(
        { url, attempt: attempt + 1, totalAttempts: maxAttempts, err: err.message },
        'Asaas request falhou, tentando novamente...',
      );

      if (attempt < maxAttempts - 1) {
        await sleep(calculateRetryDelay(attempt));
      }
    }
  }

  logger.error({ url, maxAttempts }, 'Asaas request falhou após todas as tentativas');
  throw AppError.internal('Erro de conexão com o provedor de pagamento');
}

/**
 * Returns the first customer matching the given email, or null.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function getCustomerByEmail(email) {
  const encoded = encodeURIComponent(email);
  const data = await request(`/customers?email=${encoded}`);
  if (!data || !data.data || data.data.length === 0) return null;
  return data.data[0];
}

/**
 * Creates a new customer in Asaas.
 * @param {{ nome: string, email: string, cpfCnpj?: string, telefone?: string }} params
 * @returns {Promise<object>}
 */
async function createCustomer({ nome, email, cpfCnpj, telefone }) {
  return request('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: nome, email, cpfCnpj, mobilePhone: telefone }),
  });
}

/**
 * Creates a new subscription in Asaas.
 * @param {{ customer: string, billingType: string, cycle: string, value: number, nextDueDate: string, description?: string, externalReference?: string }} params
 * @returns {Promise<object>}
 */
async function createSubscription({ customer, billingType, cycle, value, nextDueDate, description, externalReference }) {
  return request('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ customer, billingType, cycle, value, nextDueDate, description, externalReference }),
  });
}

/**
 * Cancels a subscription by ID.
 * @param {string} subscriptionId
 * @returns {Promise<object|null>}
 */
async function cancelSubscription(subscriptionId) {
  return request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

/**
 * Gets a subscription by ID.
 * @param {string} subscriptionId
 * @returns {Promise<object>}
 */
async function getSubscription(subscriptionId) {
  return request(`/subscriptions/${subscriptionId}`);
}

/**
 * Gets all payments for a subscription.
 * @param {string} subscriptionId
 * @returns {Promise<object>}
 */
async function getPaymentsBySubscription(subscriptionId) {
  const encoded = encodeURIComponent(subscriptionId);
  return request(`/payments?subscription=${encoded}`);
}

export const asaas = {
  getCustomerByEmail,
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscription,
  getPaymentsBySubscription,
};

export default asaas;
