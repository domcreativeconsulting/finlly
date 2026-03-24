import api from './api.js';

export const contasService = {
  async listar(params = {}) {
    const response = await api.get('/contas', { params });
    return response.data;
  },

  async buscar(id) {
    const response = await api.get(`/contas/${id}`);
    return response.data;
  },

  async criar(data) {
    const response = await api.post('/contas', data);
    return response.data;
  },

  async atualizar(id, data) {
    const response = await api.put(`/contas/${id}`, data);
    return response.data;
  },

  async excluir(id) {
    const response = await api.delete(`/contas/${id}`);
    return response.data;
  },
};
