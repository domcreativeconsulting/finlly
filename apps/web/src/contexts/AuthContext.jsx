import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { authService } from '../services/auth.service.js';
import { setAccessToken, setLogoutHandler } from '../services/api.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const storeToken = useCallback((token) => {
    setAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // ignore errors on logout
    } finally {
      storeToken(null);
      setUsuario(null);
    }
  }, [storeToken]);

  useEffect(() => {
    setLogoutHandler(() => {
      storeToken(null);
      setUsuario(null);
    });
  }, [storeToken]);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const data = await authService.refresh();
        storeToken(data.accessToken);
        const me = await authService.me();
        setUsuario(me);
      } catch {
        storeToken(null);
        setUsuario(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadCurrentUser();
  }, [storeToken]);

  const login = useCallback(
    async (email, senha) => {
      const data = await authService.login(email, senha);
      storeToken(data.accessToken);
      try {
        const me = await authService.me();
        setUsuario(me);
      } catch {
        // /auth/me failed after a successful login — use the basic user data
        // returned by the login response as a fallback so the session still starts.
        setUsuario(data.usuario ?? null);
      }
    },
    [storeToken],
  );

  const register = useCallback(async (nome, email, senha) => {
    await authService.register(nome, email, senha);
  }, []);

  const refresh = useCallback(async () => {
    const data = await authService.refresh();
    storeToken(data.accessToken);
  }, [storeToken]);

  const forgotPassword = useCallback(async (email) => {
    await authService.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token, novaSenha) => {
    await authService.resetPassword(token, novaSenha);
  }, []);

  const verifyEmail = useCallback(async (token) => {
    await authService.verifyEmail(token);
  }, []);

  const value = useMemo(
    () => ({
      usuario,
      isAuthenticated: !!accessToken,
      isLoading,
      accessToken,
      login,
      register,
      logout,
      refresh,
      forgotPassword,
      resetPassword,
      verifyEmail,
    }),
    [
      usuario,
      accessToken,
      isLoading,
      login,
      register,
      logout,
      refresh,
      forgotPassword,
      resetPassword,
      verifyEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
