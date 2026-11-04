import { Platform } from 'react-native';

// Set to true when testing outside on mobile data (cellular 4G/5G) or remote networks:
export const USE_TUNNEL = true;
export const PUBLIC_TUNNEL_URL = 'https://rakshasetu-backend-4775.onrender.com';

// Current PC Wi-Fi IP and backend port (for same local Wi-Fi network):
export const PC_WIFI_IP = '192.168.1.3';
export const BACKEND_PORT = '5001';

export const getDefaultBaseUrl = () => {
  if (Platform.OS === 'web') {
    return `http://localhost:${BACKEND_PORT}`;
  }
  if (USE_TUNNEL && PUBLIC_TUNNEL_URL) {
    return PUBLIC_TUNNEL_URL;
  }
  // Physical devices connected to Wi-Fi can directly reach the PC's Wi-Fi IP:
  return `http://${PC_WIFI_IP}:${BACKEND_PORT}`;
};

export const API_ENDPOINTS = {
  // Auth
  TOURIST_LOGIN: '/auth/tourist-login',
  ADMIN_LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  DEMO_LOGIN: '/auth/demo-login',
  ME: '/auth/me',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  LOGOUT: '/auth/logout',

  // Locations & Geofence
  LOCATIONS: '/locations',
  ZONES: '/zones',
  SAFE_HAVENS: '/locations/safe-havens',
  ROUTE: '/locations/route',

  // Emergency SOS & Incidents
  INCIDENTS: '/incidents',
  SOS: '/incidents/sos',
  OFFLINE_BEACON: '/incidents/offline-beacon',
  CANCEL_INCIDENT: (id) => `/incidents/${id}/cancel`,

  // Alerts & Safety Info
  ALERTS: '/alerts',
  ANNOUNCEMENTS: '/announcements',
  SUPPORT: '/support',
  UPDATES_CHECK: '/updates/check',

  // Trips
  TRIPS: '/trips',
  TRIP_DETAIL: (id) => `/trips/${id}`,

  // Raksha AI Assistant
  CHAT_ASSISTANT: '/chat/assistant',
  CHAT_INITIAL_STATUS: '/chat/initial-status',
  CHAT_TRANSCRIBE: '/chat/transcribe',
};

export default {
  PC_WIFI_IP,
  BACKEND_PORT,
  getDefaultBaseUrl,
  API_ENDPOINTS,
};
