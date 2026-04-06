import api from './api.js';

export const dashboardService = {
  async getKPIs(params = {}) {
    const response = await api.get('/dashboard/kpis', { params });
    return response.data;
  },

  async getEvolucaoMensal(meses = 6) {
    const response = await api.get('/dashboard/evolucao', { params: { meses } });
    return response.data;
  },

  async getTopCategorias(params = {}) {
    const response = await api.get('/dashboard/categorias', { params });
    return response.data;
  },

  async getSaldoPorConta() {
    const response = await api.get('/dashboard/contas');
    return response.data;
  },

  async getRelatorio(params = {}) {
    const response = await api.get('/relatorios', { params });
    return response.data;
  },

  async exportarRelatorioCSV(params = {}) {
    const response = await api.get('/relatorios/exportar', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};
