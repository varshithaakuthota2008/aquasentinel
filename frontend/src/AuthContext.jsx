import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('aq_token') || '');
  const [loading, setLoading] = useState(true);

  const login = useCallback((tokenData) => {
    setToken(tokenData.access_token);
    setUser(tokenData.user);
    localStorage.setItem('aq_token', tokenData.access_token);
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
    localStorage.removeItem('aq_token');
  }, []);

  // Restore session on mount
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    authApi.me(token)
      .then(u => setUser(u))
      .catch(() => { setToken(''); localStorage.removeItem('aq_token'); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
