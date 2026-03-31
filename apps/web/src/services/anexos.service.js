import api from './api.js';

export const anexosService = {
  /**
   * Upload de arquivo (multipart/form-data, campo "file").
   * @param {File} file
   * @returns {Promise<object>}
   */
  async upload(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/anexos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /**
   * Lista anexos do usuário com filtros opcionais.
   * @param {{ entidade_tipo?: string, entidade_id?: string, page?: number, limit?: number }} params
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  async listar(params = {}) {
    const res = await api.get('/anexos', { params });
    return res.data;
  },

  /**
   * Busca um anexo por ID.
   * @param {string} id
   * @returns {Promise<object>}
   */
  async buscar(id) {
    const res = await api.get(`/anexos/${id}`);
    return res.data;
  },

  /**
   * Soft delete de um anexo.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async excluir(id) {
    await api.delete(`/anexos/${id}`);
  },

  /**
   * Vincula um anexo a uma entidade financeira.
   * @param {string} id - ID do anexo
   * @param {{ entidade_tipo: string, entidade_id: string }} data
   * @returns {Promise<object>}
   */
  async vincular(id, data) {
    const res = await api.post(`/anexos/${id}/vinculos`, data);
    return res.data;
  },

  /**
   * Remove vínculo de um anexo com uma entidade.
   * @param {string} id - ID do anexo
   * @param {{ entidade_tipo: string, entidade_id: string }} data
   * @returns {Promise<void>}
   */
  async desvincular(id, data) {
    await api.delete(`/anexos/${id}/vinculos`, { data });
  },

  /**
   * Busca resultado OCR de um anexo.
   * @param {string} id
   * @returns {Promise<object>}
   */
  async buscarOcr(id) {
    const res = await api.get(`/anexos/${id}/ocr`);
    return res.data;
  },

  /**
   * Confirma/ajusta resultado OCR antes de criar registro financeiro.
   * @param {string} id
   * @param {{ extracted_amount?: number, extracted_date?: string, extracted_description?: string, extracted_type?: string }} data
   * @returns {Promise<object>}
   */
  async confirmarOcr(id, data) {
    const res = await api.post(`/anexos/${id}/ocr/confirmar`, data);
    return res.data;
  },
};
