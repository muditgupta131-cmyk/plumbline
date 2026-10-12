import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, authService, session } from '@/services';
import type { AuthSession, LoginPayload, RegisterPayload, User } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const queryClient = useQueryClient();

  const applySession = useCallback((result: AuthSession): User => {
    session.setAccessToken(result.accessToken);
    setUserState(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const clearSession = useCallback(() => {
    session.setAccessToken(null);
    setUserState(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let active = true;

    authService
      .refresh()
      .then((result) => {
        if (active) applySession(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.isNetworkError) {
          setStatus('anonymous');
          return;
        }
        session.setAccessToken(null);
        setStatus('anonymous');
      });

    return () => {
      active = false;
    };
  }, [applySession]);

  useEffect(() => {
    session.onExpired(() => {
      setUserState(null);
      setStatus('anonymous');
      queryClient.clear();
    });
  }, [queryClient]);

  const login = useCallback(
    async (payload: LoginPayload) => applySession(await authService.login(payload)),
    [applySession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => applySession(await authService.register(payload)),
    [applySession],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => applySession(await authService.google(credential)),
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      login,
      register,
      loginWithGoogle,
      logout,
      setUser: setUserState,
    }),
    [user, status, login, register, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
