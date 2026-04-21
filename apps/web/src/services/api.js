import axios from 'axios';
import { config } from '../config/env.js';

let _accessToken = null;
let _onLogout = null;
let _billingBlocked = false;

export function setAccessToken(token) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function setLogoutHandler(fn) {
  _onLogout = fn;
}

export function setBillingBlocked(blocked) {
  _billingBlocked = blocked;
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
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthRoute = originalRequest?.url?.startsWith('/auth/');

    const isBillingError =
      error.response?.status === 402 ||
      error.response?.data?.code === 'SEM_ASSINATURA' ||
      error.response?.data?.code === 'plan_inactive';

    if (isBillingError) {
      error.isPlanBlocked = true;
    }

    // Swallow silently: when the guard has already flagged the session as blocked,
    // or when the server itself signals a billing error (handles the race where
    // data-loading effects fire before InadimplenteGuard's effect sets the flag).
    if (_billingBlocked || isBillingError) {
      return new Promise(() => {});
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
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
  }
);

export default api;
