import api from './api.js';

export const authService = {
  async login(email, senha) {
    const response = await api.post('/auth/login', { email, senha });
    return response.data;
  },

  async register(nome, email, senha) {
    const response = await api.post('/auth/register', { nome, email, senha });
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  async refresh() {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  async getMe() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token, nova_senha) {
    const response = await api.post('/auth/reset-password', { token, nova_senha });
    return response.data;
  },

  async verifyEmail(token) {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  async resendVerificationEmail(email) {
    const response = await api.post('/auth/resend-verification-email', { email });
    return response.data;
  },
};
