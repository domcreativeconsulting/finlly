import api from './api.js';

export const contasReceberService = {
  async listar(params = {}) {
    const response = await api.get('/contas-receber', { params });
    return response.data; // { data, total, page, totalPages }
  },

  async buscar(id) {
    const response = await api.get(`/contas-receber/${id}`);
    return response.data;
  },

  async criar(data) {
    const response = await api.post('/contas-receber', data);
    return response.data;
  },

  async atualizar(id, data) {
    const response = await api.put(`/contas-receber/${id}`, data);
    return response.data;
  },

  async excluir(id) {
    const response = await api.delete(`/contas-receber/${id}`);
    return response.data;
  },

  async receber(id, data = {}) {
    const response = await api.post(`/contas-receber/${id}/receber`, data);
    return response.data;
  },

  async cancelar(id) {
    const response = await api.patch(`/contas-receber/${id}/cancelar`);
    return response.data;
  },

  async listarGrupo(grupoId) {
    const response = await api.get(`/contas-receber/grupos/${grupoId}`);
    return response.data;
  },

  async cancelarGrupo(grupoId) {
    const response = await api.patch(`/contas-receber/grupos/${grupoId}/cancelar`);
    return response.data;
  },
};
