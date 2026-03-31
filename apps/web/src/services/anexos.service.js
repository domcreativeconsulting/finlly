import api from './api.js';

export const anexosService = {
  async upload(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/anexos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async listar(params = {}) {
    const response = await api.get('/anexos', { params });
    return response.data;
  },

  async buscar(id) {
    const response = await api.get(`/anexos/${id}`);
    return response.data;
  },

  async excluir(id) {
    const response = await api.delete(`/anexos/${id}`);
    return response.data;
  },

  async vincular(id, data) {
    const response = await api.post(`/anexos/${id}/vinculos`, data);
    return response.data;
  },

  async desvincular(id, data) {
    const response = await api.delete(`/anexos/${id}/vinculos`, { data });
    return response.data;
  },

  async buscarOcr(id) {
    const response = await api.get(`/anexos/${id}/ocr`);
    return response.data;
  },

  async confirmarOcr(id, data) {
    const response = await api.post(`/anexos/${id}/ocr/confirmar`, data);
    return response.data;
  },
};
