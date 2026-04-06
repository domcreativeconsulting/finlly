import api from './api.js';

export const extratoService = {
  async listar(params = {}) {
    const response = await api.get('/cash-movements', { params });
    return response.data; // { items, page, perPage, total, totalPages, totals }
  },

  async exportar(params = {}) {
    const response = await api.get('/cash-movements/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};
