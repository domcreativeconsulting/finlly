import api from './api.js';

export const cashMovementsService = {
  async criarManual(data) {
    const response = await api.post('/cash-movements/manual', data);
    return response.data; // { item: { ... } }
  },
};
