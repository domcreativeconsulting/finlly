import axios from 'axios';
import { config } from '../config/env.js';

let _accessToken = null;
let _onLogout = null;

export function setAccessToken(token) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function setLogoutHandler(fn) {
  _onLogout = fn;
}

const api = axios.create({
  baseURL: config.VITE_API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  (cfg) => {
    if (_accessToken) {
      cfg.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return cfg;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;

        setAccessToken(accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (_refreshError) {
        setAccessToken(null);
        if (_onLogout) {
          _onLogout();
        } else {
          window.location.href = '/login';
        }
        return Promise.reject(_refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
