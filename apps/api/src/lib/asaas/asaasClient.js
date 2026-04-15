import { config } from '../../config/env.js';
import { AppError } from '../../errors/AppError.js';
import logger from '../../logger.js';
import { CircuitBreaker } from '../circuitBreaker.js';

const RETRY_BASE_DELAY_MS = 500;
const RETRY_JITTER_MS = 200;
const RETRY_MAX_DELAY_MS = 10000;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 409, 422]);

const asaasCircuitBreaker = new CircuitBreaker({
  name: 'asaas',
  failureThreshold: config.ASAAS_CB_FAILURE_THRESHOLD,
  resetTimeoutMs: config.ASAAS_CB_RESET_TIMEOUT_MS,
});

/**
 * Returns the Asaas base URL from config or derives it from ASAAS_ENV.
 * @returns {string}
 */
function getBaseUrl() {
  if (config.ASAAS_BASE_URL) return config.ASAAS_BASE_URL;
  return config.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/v3';
}

/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs an authenticated HTTP request to the Asaas API with
 * automatic retry (exponential backoff + jitter) and per-attempt timeout.
 * @param {string} path - API path (e.g. '/customers')
 * @param {RequestInit} [options] - fetch options
 * @returns {Promise<object>}
 */
async function _request(path, options = {}) {
  const url = `${getBaseUrl()}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    access_token: config.ASAAS_API_KEY ?? '',
    ...options.headers,
  };

  const maxRetries = config.ASAAS_MAX_RETRIES;
  const timeoutMs = config.ASAAS_TIMEOUT_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(url, { ...options, headers, signal: controller.signal });
    } catch (err) {
      const isAbort = err.name === 'AbortError' || err.name === 'TimeoutError';
      const isNetwork = err instanceof TypeError;
      if (isAbort || isNetwork) {
        logger.warn({ err, url, attempt }, 'Asaas request failed (retriable)');
        if (attempt < maxRetries) {
          const delay = Math.min(
            RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * RETRY_JITTER_MS,
            RETRY_MAX_DELAY_MS
          );
          await sleep(delay);
          continue;
        }
        logger.error({ err, url }, 'Asaas request exhausted retries');
        throw AppError.internal('Erro de conexão com o provedor de pagamento');
      }
      logger.error({ err, url }, 'Asaas network error');
      throw AppError.internal('Erro de conexão com o provedor de pagamento');
    } finally {
      clearTimeout(timer);
    }

    // 404 = resource not found — treated as non-retryable error
if (response.status === 404) {
  let body = null;
  try { body = await response.json(); } catch { /* ignore */ }
  logger.error({ status: 404, body, url }, 'Asaas HTTP error');
  throw AppError.internal(`Erro no provedor de pagamento: 404`);
}

    if (NON_RETRYABLE_STATUSES.has(response.status)) {
      let body = null;
      try {
        body = await response.json();
      } catch {
        // ignore parse errors
      }
      logger.error({ status: response.status, body, url }, 'Asaas HTTP error');
      throw AppError.internal(`Erro no provedor de pagamento: ${response.status}`);
    }

    if (RETRYABLE_STATUSES.has(response.status)) {
      let retryAfterMs = null;
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          retryAfterMs = parseFloat(retryAfter) * 1000;
        }
      }
      logger.warn({ status: response.status, url, attempt }, 'Asaas request failed (retriable)');
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
      logger.error({ status: response.status, url }, 'Asaas request exhausted retries');
      throw AppError.internal(`Erro no provedor de pagamento: ${response.status}`);
    }

    if (response.status === 204) return null;

    return response.json();
  }
}

/**
 * Public entry point — guarded by the circuit breaker.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<object>}
 */
function request(path, options = {}) {
  return asaasCircuitBreaker.execute(() => _request(path, options));
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
 * Supports PIX and CREDIT_CARD billing types.
 * For CREDIT_CARD, pass creditCard and creditCardHolderInfo objects.
 *
 * @param {{
 *   customer: string,
 *   billingType: string,
 *   cycle: string,
 *   value: number,
 *   nextDueDate: string,
 *   description?: string,
 *   externalReference?: string,
 *   creditCard?: {
 *     holderName: string,
 *     number: string,
 *     expiryMonth: string,
 *     expiryYear: string,
 *     ccv: string,
 *   },
 *   creditCardHolderInfo?: {
 *     name: string,
 *     email: string,
 *     cpfCnpj: string,
 *     postalCode?: string,
 *     addressNumber?: string,
 *     phone?: string,
 *   },
 *   remoteIp?: string,
 * }} params
 * @returns {Promise<object>}
 */
async function createSubscription({
  customer,
  billingType,
  cycle,
  value,
  nextDueDate,
  description,
  externalReference,
  creditCard,
  creditCardHolderInfo,
  remoteIp,
}) {
  const body = {
    customer,
    billingType,
    cycle,
    value,
    nextDueDate,
    description,
    externalReference,
    ...(creditCard           ? { creditCard }           : {}),
    ...(creditCardHolderInfo ? { creditCardHolderInfo } : {}),
    ...(remoteIp             ? { remoteIp }             : {}),
  };

  return request('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(body),
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

export { asaasCircuitBreaker };
export default asaas;
