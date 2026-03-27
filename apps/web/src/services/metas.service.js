import api from './api.js';

export const metasService = {
  async listar(params = {}) {
    const res = await api.get('/goals', { params });
    return res.data;
  },
  async obter(id) {
    const res = await api.get(`/goals/${id}`);
    return res.data;
  },
  async criar(data) {
    const res = await api.post('/goals', data);
    return res.data;
  },
  async atualizar(id, data) {
    const res = await api.patch(`/goals/${id}`, data);
    return res.data;
  },
  async excluir(id) {
    await api.delete(`/goals/${id}`);
  },
  async getProgresso(id) {
    const res = await api.get(`/goals/${id}/progress`);
    return res.data;
  },
  async criarMovimento(id, data) {
    const res = await api.post(`/goals/${id}/movements`, data);
    return res.data;
  },
  async excluirMovimento(id, movId) {
    await api.delete(`/goals/${id}/movements/${movId}`);
  },
  async listarMovimentos(id, params = {}) {
    const res = await api.get(`/goals/${id}/movements`, { params });
    return res.data;
  },
};
