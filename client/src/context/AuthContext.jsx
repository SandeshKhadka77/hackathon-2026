import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { AuthContext } from './AuthContextObject';

const AUTH_TOKEN_KEY = 'avasar_token';
const LEGACY_TOKEN_KEY = 'sajilo_token';

// Legacy fallback supports seamless migration for users with existing local sessions.
const readStoredToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(readStoredToken());
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const syncToken = useCallback((nextToken) => {
    if (nextToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      setToken(nextToken);
      return;
    }

    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    setToken(null);
  }, []);

  const loadMe = useCallback(async () => {
    const existingToken = readStoredToken();
    if (!existingToken) {
      setUser(null);
      setBooting(false);
      return;
    }

    if (localStorage.getItem(LEGACY_TOKEN_KEY) && !localStorage.getItem(AUTH_TOKEN_KEY)) {
      // Migrate key once after rebrand to avoid forcing re-login.
      localStorage.setItem(AUTH_TOKEN_KEY, existingToken);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user || null);
    } catch {
      syncToken(null);
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, [syncToken]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (payload) => {
    const response = await api.post('/auth/login', payload);
    syncToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }, [syncToken]);

  const register = useCallback(async (payload) => {
    const response = await api.post('/auth/register', payload);
    syncToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }, [syncToken]);

  const registerOrganization = useCallback(async (payload) => {
    const response = await api.post('/auth/register-organization', payload);
    syncToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }, [syncToken]);

  const logout = useCallback(() => {
    syncToken(null);
    setUser(null);
  }, [syncToken]);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me');
    setUser(response.data.user || null);
  }, []);

  const value = {
    token,
    user,
    booting,
    isAuthenticated: !!token,
    login,
    register,
    registerOrganization,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
