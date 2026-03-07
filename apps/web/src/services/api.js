import axios from 'axios';
import { config } from '../config/env.js';

let _accessToken = null;
let _onTokenRefreshed = null;
let _isRefreshing = false;
let _pendingRequests = [];

export function setAccessToken(token) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function clearAccessToken() {
  _accessToken = null;
}

const api = axios.create({
  baseURL: config.VITE_API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  (requestConfig) => {
    if (_accessToken) {
      requestConfig.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return requestConfig;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _pendingRequests.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      try {
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;

        setAccessToken(accessToken);

        _pendingRequests.forEach(({ resolve }) => resolve(accessToken));
        _pendingRequests = [];

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        _pendingRequests.forEach(({ reject }) => reject(refreshError));
        _pendingRequests = [];

        clearAccessToken();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
