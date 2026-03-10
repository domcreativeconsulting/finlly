import api from './api.js';

export const perfilService = {
  async getPerfil() {
    const response = await api.get('/perfil');
    return response.data;
  },

  async updatePerfil(data) {
    const response = await api.patch('/perfil', data);
    return response.data;
  },
};
