import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchCurrentUser, loginAccount, logoutAccount, registerAccount } from './authApi';
import type { LoginForm, RegisterForm, User } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthOpen: boolean;
  authView: 'login' | 'register';
  openLogin: () => void;
  openRegister: () => void;
  closeAuth: () => void;
  login: (form: LoginForm) => Promise<User>;
  register: (form: RegisterForm) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then(current => { if (active) setUser(current); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openLogin = useCallback(() => { setAuthView('login'); setAuthOpen(true); }, []);
  const openRegister = useCallback(() => { setAuthView('register'); setAuthOpen(true); }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const login = useCallback(async (form: LoginForm) => {
    const current = await loginAccount(form);
    setUser(current);
    return current;
  }, []);

  const register = useCallback(async (form: RegisterForm) => {
    const current = await registerAccount(form);
    setUser(current);
    return current;
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, loading, isAuthOpen, authView, openLogin, openRegister, closeAuth, login, register, logout,
  }), [authView, closeAuth, isAuthOpen, loading, login, logout, openLogin, openRegister, register, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
