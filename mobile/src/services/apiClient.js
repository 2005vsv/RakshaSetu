import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDefaultBaseUrl, USE_TUNNEL, PUBLIC_TUNNEL_URL } from '../config/api';

const TOKEN_KEY = '@rakshasetu_token';
const USER_KEY = '@rakshasetu_user';
const BASE_URL_KEY = '@rakshasetu_base_url';

let customBaseUrl = null;

export const getStoredBaseUrl = async () => {
  try {
    if (USE_TUNNEL && PUBLIC_TUNNEL_URL) {
      customBaseUrl = PUBLIC_TUNNEL_URL;
      return PUBLIC_TUNNEL_URL;
    }
    const saved = await AsyncStorage.getItem(BASE_URL_KEY);
    if (saved && !saved.includes('172.29.166.170') && !saved.includes('192.168.1.6')) {
      customBaseUrl = saved;
      return saved;
    }
  } catch (_) {}
  customBaseUrl = getDefaultBaseUrl();
  return getDefaultBaseUrl();
};

export const setStoredBaseUrl = async (url) => {
  try {
    const trimmed = String(url || '').trim().replace(/\/+$/, '');
    await AsyncStorage.setItem(BASE_URL_KEY, trimmed);
    customBaseUrl = trimmed;
    apiClient.defaults.baseURL = trimmed;
    return trimmed;
  } catch (e) {
    console.error('Failed to save base URL', e);
  }
};

export const apiClient = axios.create({
  baseURL: getDefaultBaseUrl(),
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
    'X-Portal': 'tourist',
    'X-Pinggy-No-Screen': 'true',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

// Request interceptor to attach Bearer token and current Base URL
apiClient.interceptors.request.use(
  async (config) => {
    try {
      config.headers = config.headers || {};
      config.headers['X-Pinggy-No-Screen'] = 'true';
      config.headers['Bypass-Tunnel-Reminder'] = 'true';

      if (USE_TUNNEL && PUBLIC_TUNNEL_URL) {
        config.baseURL = PUBLIC_TUNNEL_URL;
      } else {
        if (!customBaseUrl) {
          const url = await AsyncStorage.getItem(BASE_URL_KEY);
          if (url && !url.includes('172.29.166.170') && !url.includes('192.168.1.6')) {
            customBaseUrl = url;
          }
        }
        if (customBaseUrl) {
          config.baseURL = customBaseUrl;
        }
      }

      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) {}
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle unified errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('Network Error')) {
      const activeUrl = customBaseUrl || getDefaultBaseUrl();
      return Promise.reject(
        new Error(`Cannot reach RakshaSetu server at ${activeUrl}. Please ensure your mobile data is active or verify the Server Host in Profile.`)
      );
    }
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Network request failed';
    return Promise.reject(new Error(message));
  }
);

// Token & Session Storage Helpers
export const storeAuthSession = async (user, token) => {
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to save auth session', e);
  }
};

export const getStoredToken = async () => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (_) {
    return null;
  }
};

export const getStoredUser = async () => {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

export const clearAuthSession = async () => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  } catch (e) {
    console.error('Failed to clear session', e);
  }
};

export default apiClient;

