import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { TOKEN_KEY, getToken, setToken } from '../api/http';
import { clearCache } from '../lib/cache';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Only a saved token needs checking; without one we know right away.
  const [loading, setLoading] = useState(() => !!getToken());

  // On first load: if we have a saved token, ask the server who we are.
  useEffect(() => {
    if (!getToken()) return;
    let active = true;
    authApi.me()
      .then((u) => { if (active) setUser(u); })
      .catch(() => { if (active) { setToken(null); setUser(null); } }) // invalid/expired token — start signed out
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // If any request hits 401, the http layer fires this event → log out.
  useEffect(() => {
    const handler = () => { clearCache(); setUser(null); };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  // Another tab signed in or out (the saved token changed there): follow it, so
  // this tab never keeps the old user's role and cached data with the new token.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY) return;
      clearCache();
      if (!e.newValue) { setUser(null); return; }
      authApi.me().then(setUser).catch(() => setUser(null));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    clearCache(); // never show the previous user's cached data
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearCache();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
