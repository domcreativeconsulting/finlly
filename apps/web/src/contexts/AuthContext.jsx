import { createContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service.js';
import { setAccessToken, clearAccessToken } from '../services/api.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const storeToken = useCallback((token) => {
    setAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const clearToken = useCallback(() => {
    clearAccessToken();
    setAccessTokenState(null);
  }, []);

  useEffect(() => {
    async function initAuth() {
      try {
        const refreshResult = await authService.refresh();
        storeToken(refreshResult.accessToken);
        const me = await authService.getMe();
        setUsuario(me);
      } catch {
        clearToken();
        setUsuario(null);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, [storeToken, clearToken]);

  const login = useCallback(async (email, senha) => {
    const result = await authService.login(email, senha);
    storeToken(result.accessToken);
    setUsuario(result.usuario);
  }, [storeToken]);

  const register = useCallback(async (nome, email, senha) => {
    await authService.register(nome, email, senha);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearToken();
      setUsuario(null);
    }
  }, [clearToken]);

  const refresh = useCallback(async () => {
    const result = await authService.refresh();
    storeToken(result.accessToken);
    const me = await authService.getMe();
    setUsuario(me);
  }, [storeToken]);

  const forgotPassword = useCallback(async (email) => {
    return authService.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token, novaSenha) => {
    return authService.resetPassword(token, novaSenha);
  }, []);

  const verifyEmail = useCallback(async (token) => {
    return authService.verifyEmail(token);
  }, []);

  const value = {
    usuario,
    isAuthenticated: !!accessToken && !!usuario,
    isLoading,
    accessToken,
    login,
    register,
    logout,
    refresh,
    forgotPassword,
    resetPassword,
    verifyEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
