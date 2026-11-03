import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, {
  storeAuthSession,
  clearAuthSession,
  getStoredUser,
  getStoredToken,
} from '../services/apiClient';
import socketService from '../services/socketService';
import locationService from '../services/locationService';
import { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSOS, setActiveSOS] = useState(null);
  const [safetyScore, setSafetyScore] = useState(92);

  // Restore session from AsyncStorage on startup
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await getStoredToken();
        const savedUser = await getStoredUser();

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(savedUser);
          await socketService.connect();
          locationService.startTracking();
        }
      } catch (e) {
        console.warn('Failed to restore auth session:', e);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const handleAuthSuccess = async (userData, tokenString) => {
    setUser(userData);
    setToken(tokenString);
    await storeAuthSession(userData, tokenString);
    await socketService.connect();
    locationService.startTracking();
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post(API_ENDPOINTS.TOURIST_LOGIN, { email, password });
      await handleAuthSuccess(res.data.user, res.data.token);
      return res.data;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (formData) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post(API_ENDPOINTS.REGISTER, formData);
      await handleAuthSuccess(res.data.user, res.data.token);
      return res.data;
    } finally {
      setIsLoading(false);
    }
  };

  // Instant one-click Tourist Demo Session backed by MongoDB
  const quickDemoLogin = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.post(API_ENDPOINTS.DEMO_LOGIN, { role: 'tourist' });
      await handleAuthSuccess(res.data.user, res.data.token);
      return res.data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      apiClient.post(API_ENDPOINTS.LOGOUT).catch(() => {});
      locationService.stopTracking();
      socketService.disconnect();
      await clearAuthSession();
      setUser(null);
      setToken(null);
      setActiveSOS(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    try {
      const res = await apiClient.patch(API_ENDPOINTS.ME, updates);
      const updatedUser = { ...user, ...(res.data.user || res.data) };
      setUser(updatedUser);
      await storeAuthSession(updatedUser, token);
      return updatedUser;
    } catch (e) {
      throw e;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        activeSOS,
        setActiveSOS,
        safetyScore,
        setSafetyScore,
        login,
        register,
        quickDemoLogin,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
