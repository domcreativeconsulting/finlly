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

function getBaseUrl() {
  if (config.ASAAS_BASE_URL) return config.ASAAS_BASE_URL;
  return config.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/v3';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    if (response.status === 404) {
      let body = null;
      try { body = await response.json(); } catch { /* ignore */ }
      logger.error({ status: 404, body, url }, 'Asaas HTTP error');
      throw AppError.internal(`Erro no provedor de pagamento: 404`);
    }

    if (NON_RETRYABLE_STATUSES.has(response.status)) {
      let body = null;
      try { body = await response.json(); } catch { /* ignore */ }
      logger.error({ status: response.status, body, url }, 'Asaas HTTP error');

      // Repassa a mensagem real da Asaas para o frontend
      const asaasMsg = body?.errors?.[0]?.description ?? body?.message ?? null;
      if (asaasMsg) throw AppError.badRequest(asaasMsg);
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

function request(path, options = {}) {
  return asaasCircuitBreaker.execute(() => _request(path, options));
}

async function getCustomerByEmail(email) {
  const encoded = encodeURIComponent(email);
  const data = await request(`/customers?email=${encoded}`);
  if (!data || !data.data || data.data.length === 0) return null;
  return data.data[0];
}

async function createCustomer({ nome, email, cpfCnpj, telefone }) {
  return request('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: nome, email, cpfCnpj, mobilePhone: telefone }),
  });
}

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

async function cancelSubscription(subscriptionId) {
  return request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

async function getSubscription(subscriptionId) {
  return request(`/subscriptions/${subscriptionId}`);
}

async function getPaymentsBySubscription(subscriptionId) {
  const encoded = encodeURIComponent(subscriptionId);
  return request(`/payments?subscription=${encoded}`);
}

async function getPixQrCode(paymentId) {
  return request(`/payments/${paymentId}/pixQrCode`);
}

export const asaas = {
  getCustomerByEmail,
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscription,
  getPaymentsBySubscription,
  getPixQrCode,
};

export { asaasCircuitBreaker };
export default asaas;
