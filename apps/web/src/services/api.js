import axios from 'axios';
import { toast } from 'react-toastify';
import { config } from '../config/env.js';

let _accessToken = null;
let _onLogout = null;
let _billingBlocked = false;

const _INACTIVE_TOAST_KEY = 'finlly_inactive_toast_shown';

function _showAccountInactiveToast() {
  if (sessionStorage.getItem(_INACTIVE_TOAST_KEY)) return;
  sessionStorage.setItem(_INACTIVE_TOAST_KEY, 'true');
  toast.warning(
    'Algumas funcionalidades não estão disponíveis. Ative sua conta para ter acesso completo.',
    { autoClose: 6000 }
  );
}

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
  if (!blocked) sessionStorage.removeItem(_INACTIVE_TOAST_KEY);
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

    // Swallow: when the guard flagged the session as blocked or the server signals
    // a billing error. Show a single warning toast (once per session) in place of
    // the individual per-call error toasts that would otherwise fire.
    if (_billingBlocked || isBillingError) {
      _showAccountInactiveToast();
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
