import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchCurrentUser, loginAccount, registerAccount } from '../authApi';
import type { LoginForm, RegisterForm } from '../authApi';
import type { User } from '../types';

const TOKEN_KEY = 'vault_auth_token';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (form: LoginForm) => Promise<User>;
  loginAdmin: (form: LoginForm) => Promise<User>;
  register: (form: RegisterForm) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // A saved token survives app restarts; expo-secure-store is the encrypted
      // equivalent of the httpOnly cookie the web app relies on.
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        if (active) setLoading(false);
        return;
      }
      const current = await fetchCurrentUser(token);
      if (!active) return;
      if (current) {
        setUser(current);
      } else {
        // The token expired or the account no longer exists.
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (form: LoginForm) => {
    const { user: current, token } = await loginAccount(form);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(current);
    return current;
  }, []);

  // Ported from the web's loginAdminAccount: the same credentials check, but the
  // session is only kept — never persisted — when the account actually has admin access.
  const loginAdmin = useCallback(async (form: LoginForm) => {
    const { user: current, token } = await loginAccount(form);
    if (current.role !== 'admin') throw new Error('This account does not have administrator access.');
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(current);
    return current;
  }, []);

  const register = useCallback(async (form: RegisterForm) => {
    const { user: current, token } = await registerAccount(form);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(current);
    return current;
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, loginAdmin, register, logout }),
    [loading, login, loginAdmin, logout, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
