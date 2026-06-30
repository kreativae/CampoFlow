'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from './api';
import type { AuthResponse, User } from './types';

const STORAGE_KEY = 'campoflow.auth';

interface StoredAuth {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    mfaCode?: string,
  ) => Promise<{ mfaRequired: boolean }>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persist(auth: StoredAuth | null) {
  if (auth) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Platform staff have no customer features (no Account/Subscription of their
  // own — see AuthService.register) and the API blocks them from every non-/admin,
  // non-/auth route. Mirrors the inverse check in admin/layout.tsx, but lives here
  // so it applies app-wide instead of only inside the customer pages staff would
  // otherwise be allowed to land on.
  useEffect(() => {
    if (loading || !user) return;
    if (user.isPlatformAdmin && !pathname.startsWith('/admin')) {
      router.replace('/admin');
    }
  }, [loading, user, pathname, router]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const stored = JSON.parse(raw) as StoredAuth;
        // Hydrating client-only auth state from localStorage on mount is the intended use case here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(stored.user);
        setAccessToken(stored.accessToken);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string, mfaCode?: string) {
    const res = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password, mfaCode },
    });
    if (res.mfaRequired) {
      return { mfaRequired: true };
    }
    setUser(res.user!);
    setAccessToken(res.accessToken!);
    persist({ user: res.user!, accessToken: res.accessToken!, refreshToken: res.refreshToken! });
    return { mfaRequired: false };
  }

  async function register(email: string, password: string, name: string) {
    const res = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
    setUser(res.user!);
    setAccessToken(res.accessToken!);
    persist({ user: res.user!, accessToken: res.accessToken!, refreshToken: res.refreshToken! });
  }

  async function loginWithTokens(accessToken: string, refreshToken: string) {
    const fetchedUser = await apiFetch<User>('/auth/me', { token: accessToken });
    setUser(fetchedUser);
    setAccessToken(accessToken);
    persist({ user: fetchedUser, accessToken, refreshToken });
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    persist(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, loading, login, register, loginWithTokens, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}
