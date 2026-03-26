import api from './api.js';

export const investimentosService = {
  async listarTipos() {
    const res = await api.get('/investimentos/tipos');
    return res.data;
  },
  async listar(params = {}) {
    const res = await api.get('/investimentos', { params });
    return res.data;
  },
  async criar(data) {
    const res = await api.post('/investimentos', data);
    return res.data;
  },
  async atualizar(id, data) {
    const res = await api.patch(`/investimentos/${id}`, data);
    return res.data;
  },
  async excluir(id) {
    await api.delete(`/investimentos/${id}`);
  },
  async getPosicao(id) {
    const res = await api.get(`/investimentos/${id}/posicao`);
    return res.data;
  },
  async listarEventos(id, params = {}) {
    const res = await api.get(`/investimentos/${id}/eventos`, { params });
    return res.data;
  },
  async criarEvento(id, data) {
    const res = await api.post(`/investimentos/${id}/eventos`, data);
    return res.data;
  },
  async excluirEvento(id, eventoId) {
    await api.delete(`/investimentos/${id}/eventos/${eventoId}`);
  },
};
