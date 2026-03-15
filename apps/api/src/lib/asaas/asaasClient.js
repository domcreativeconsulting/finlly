import { config } from '../../config/env.js';
import { AppError } from '../../errors/AppError.js';
import logger from '../../logger.js';

export class AsaasClient {
  constructor() {
    this.apiKey = config.ASAAS_API_KEY;
    this.baseUrl = config.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3';
  }

  /**
   * Executes a request to the Asaas API.
   * @param {string} method
   * @param {string} path
   * @param {object} [body]
   * @returns {Promise<object>}
   */
  async request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'access_token': this.apiKey,
      'Content-Type': 'application/json',
    };

    const options = { method, headers };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      logger.error({ msg: 'Asaas API network error', err: err.message, path });
      throw AppError.internal(`Erro de rede ao comunicar com Asaas: ${err.message}`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message = data?.errors?.[0]?.description || data?.message || `Asaas HTTP ${response.status}`;
      logger.error({ msg: 'Asaas API error', status: response.status, path, message });
      throw new AppError('ASAAS_ERROR', message, response.status >= 500 ? 502 : response.status);
    }

    return data;
  }

  /**
   * Creates a customer in Asaas.
   * @param {{ nome: string, email: string, cpfCnpj?: string, phone?: string }} params
   * @returns {Promise<object>}
   */
  createCustomer({ nome, email, cpfCnpj, phone }) {
    return this.request('POST', '/customers', {
      name: nome,
      email,
      ...(cpfCnpj ? { cpfCnpj } : {}),
      ...(phone ? { phone } : {}),
    });
  }

  /**
   * Gets a customer by email.
   * @param {string} email
   * @returns {Promise<object>}
   */
  async getCustomerByEmail(email) {
    const data = await this.request('GET', `/customers?email=${encodeURIComponent(email)}`);
    return data?.data?.[0] || null;
  }

  /**
   * Creates a subscription in Asaas.
   * @param {{ customer: string, billingType: string, cycle: string, value: number, nextDueDate: string, description?: string, externalReference?: string }} params
   * @returns {Promise<object>}
   */
  createSubscription({ customer, billingType, cycle, value, nextDueDate, description, externalReference }) {
    return this.request('POST', '/subscriptions', {
      customer,
      billingType,
      cycle,
      value,
      nextDueDate,
      ...(description ? { description } : {}),
      ...(externalReference ? { externalReference } : {}),
    });
  }

  /**
   * Gets a subscription by ID.
   * @param {string} subscriptionId
   * @returns {Promise<object>}
   */
  getSubscription(subscriptionId) {
    return this.request('GET', `/subscriptions/${subscriptionId}`);
  }

  /**
   * Cancels a subscription.
   * @param {string} subscriptionId
   * @returns {Promise<object>}
   */
  cancelSubscription(subscriptionId) {
    return this.request('DELETE', `/subscriptions/${subscriptionId}`);
  }

  /**
   * Gets a payment by ID.
   * @param {string} paymentId
   * @returns {Promise<object>}
   */
  getPayment(paymentId) {
    return this.request('GET', `/payments/${paymentId}`);
  }

  /**
   * Lists payments for a subscription.
   * @param {string} subscriptionId
   * @returns {Promise<object[]>}
   */
  async listPaymentsBySubscription(subscriptionId) {
    const data = await this.request('GET', `/payments?subscription=${subscriptionId}`);
    return data?.data || [];
  }
}

export const asaas = new AsaasClient();
export default asaas;
