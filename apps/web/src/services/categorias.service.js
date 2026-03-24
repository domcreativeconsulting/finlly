import api from './api.js';

export const categoriasService = {
  async listar(params = {}) {
    const response = await api.get('/categorias', { params });
    return response.data;
  },

  async buscar(id) {
    const response = await api.get(`/categorias/${id}`);
    return response.data;
  },

  async criar(data) {
    const response = await api.post('/categorias', data);
    return response.data;
  },

  async atualizar(id, data) {
    const response = await api.put(`/categorias/${id}`, data);
    return response.data;
  },

  async excluir(id) {
    const response = await api.delete(`/categorias/${id}`);
    return response.data;
  },
};
