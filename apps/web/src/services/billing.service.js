import api from './api.js';

export const billingService = {
  /**
   * Creates or updates a subscription for the authenticated user.
   * @param {{ plano: 'mensal'|'anual', ciclo: 'mensal'|'anual', formaPagamento: 'PIX'|'CREDIT_CARD', cupomCodigo?: string }} data
   */
  async subscribe(data) {
    const response = await api.post('/billing/subscribe', data);
    return response.data;
  },

  /**
   * Returns the subscription status of the authenticated user.
   * @returns {{ assinante: object }}
   */
  async getStatus() {
    const response = await api.get('/billing/status');
    return response.data;
  },

  /**
   * Cancels the subscription of the authenticated user.
   */
  async cancel() {
    const response = await api.post('/billing/cancel');
    return response.data;
  },
};
