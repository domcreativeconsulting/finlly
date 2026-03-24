import api from './api.js';

export const contasPagarService = {
  async listar(params = {}) {
    const response = await api.get('/contas-pagar', { params });
    return response.data; // { data, total, page, totalPages }
  },

  async buscar(id) {
    const response = await api.get(`/contas-pagar/${id}`);
    return response.data;
  },

  async criar(data) {
    const response = await api.post('/contas-pagar', data);
    return response.data;
  },

  async atualizar(id, data) {
    const response = await api.put(`/contas-pagar/${id}`, data);
    return response.data;
  },

  async excluir(id) {
    const response = await api.delete(`/contas-pagar/${id}`);
    return response.data;
  },

  async pagar(id, data = {}) {
    const response = await api.post(`/contas-pagar/${id}/pagar`, data);
    return response.data;
  },

  async cancelar(id) {
    const response = await api.patch(`/contas-pagar/${id}/cancelar`);
    return response.data;
  },

  async listarGrupo(grupoId) {
    const response = await api.get(`/contas-pagar/grupos/${grupoId}`);
    return response.data;
  },

  async cancelarGrupo(grupoId) {
    const response = await api.patch(`/contas-pagar/grupos/${grupoId}/cancelar`);
    return response.data;
  },
};
