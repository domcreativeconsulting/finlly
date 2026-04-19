import api from './api.js';

export const billingService = {
  /**
   * Creates or updates a subscription for the authenticated user.
   * Supports PIX and CREDIT_CARD payment methods.
   *
   * @param {{
   *   plano: 'mensal'|'anual',
   *   ciclo: 'mensal'|'anual',
   *   formaPagamento: 'PIX'|'CREDIT_CARD',
   *   nome?: string,
   *   email?: string,
   *   cpf?: string,
   *   telefone?: string,
   *   cupomCodigo?: string,
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
   *     phone?: string,
   *   },
   *   remoteIp?: string,
   * }} data
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
    // adiciona ts para evitar cache e força no-cache
    const res = await api.get('/billing/status', {
      params: { _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache' },
    });
    return res.data;
  },

  /**
   * Cancels the subscription of the authenticated user.
   */
  async cancel() {
    const response = await api.post('/billing/cancel');
    return response.data;
  },
};
