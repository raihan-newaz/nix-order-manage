import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success) {
          setUser(res.data.user);
          setToken('secure-cookie-session');
        }
      } catch {
        setToken(null);
        setUser(null);
      }
      setLoading(false);
    };

    fetchMe();
  }, []);

  useEffect(() => {
    const expire = () => { setToken(null); setUser(null); };
    window.addEventListener('nix:session-expired', expire);
    return () => window.removeEventListener('nix:session-expired', expire);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken || 'secure-cookie-session');
    setUser(newUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    void api.post('/auth/logout')
      .catch(() => undefined)
      .finally(() => { window.location.href = '/login'; });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
