import api from './api.js';

export const anexosService = {
  async upload(contaId, file) {
    const formData = new FormData();
    formData.append('arquivo', file);
    const response = await api.post(`/contas-pagar/${contaId}/anexos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async listar(contaId) {
    const response = await api.get(`/contas-pagar/${contaId}/anexos`);
    return response.data;
  },

  async deletar(anexoId) {
    const response = await api.delete(`/anexos/${anexoId}`);
    return response.data;
  },
};
