import { config } from '../../config/env.js';
import { AppError } from '../../errors/AppError.js';
import logger from '../../logger.js';

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
 * Performs an authenticated HTTP request to the Asaas API.
 * @param {string} path - API path (e.g. '/customers')
 * @param {RequestInit} [options] - fetch options
 * @returns {Promise<object>}
 */
async function request(path, options = {}) {
  const url = `${getBaseUrl()}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    access_token: config.ASAAS_API_KEY ?? '',
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    logger.error({ err, url }, 'Asaas network error');
    throw AppError.internal('Erro de conexão com o provedor de pagamento');
  }

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // ignore parse errors
    }
    logger.error({ status: response.status, body, url }, 'Asaas HTTP error');
    throw AppError.internal(`Erro no provedor de pagamento: ${response.status}`);
  }

  if (response.status === 204) return null;

  return response.json();
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
