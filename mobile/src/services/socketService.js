import { io } from 'socket.io-client';
import { getStoredBaseUrl, getStoredToken } from './apiClient';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  async connect() {
    if (this.socket?.connected) return;

    try {
      const baseUrl = await getStoredBaseUrl();
      const token = await getStoredToken();

      this.socket = io(baseUrl, {
        transports: ['websocket'],
        extraHeaders: {
          'X-Pinggy-No-Screen': 'true',
        },
        auth: {
          token: token || '',
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected to RakshaSetu realtime server');
      });

      this.socket.on('connect_error', (err) => {
        console.log('[Socket] Realtime connection warning:', err.message);
      });

      this.socket.on('incident:update', (data) => {
        this.emitLocal('incident:update', data?.incident || data);
      });

      this.socket.on('incident:updated', (data) => {
        this.emitLocal('incident:update', data?.incident || data);
      });

      this.socket.on('alert:new', (data) => {
        this.emitLocal('alert:new', data?.alert || data);
      });

      this.socket.on('alert:updated', (data) => {
        this.emitLocal('alert:new', data?.alert || data);
      });

      this.socket.on('announcement:new', (data) => {
        this.emitLocal('announcement:new', data);
      });

      this.socket.on('support:new', (data) => {
        this.emitLocal('support:new', data?.request || data);
      });

      this.socket.on('support:updated', (data) => {
        this.emitLocal('support:updated', data?.request || data);
      });

      this.socket.on('geofence:deactivated', (data) => {
        const zone = data?.zone || data;
        this.emitLocal('geofence:deactivated', zone);
        this.emitLocal('geofence:deleted', zone);
      });

      this.socket.on('geofence:deleted', (data) => {
        const zone = data?.zone || data;
        this.emitLocal('geofence:deactivated', zone);
        this.emitLocal('geofence:deleted', zone);
      });

      this.socket.on('zone:deleted', (data) => {
        const zone = data?.zone || data;
        this.emitLocal('geofence:deactivated', zone);
        this.emitLocal('geofence:deleted', zone);
      });

      this.socket.on('geofence:created', (data) => {
        this.emitLocal('geofence:created', data?.zone || data);
      });

      this.socket.on('zone:created', (data) => {
        this.emitLocal('geofence:created', data?.zone || data);
      });

      this.socket.on('geofence:updated', (data) => {
        const zone = data?.zone || data;
        if (zone?.is_active === false) {
          this.emitLocal('geofence:deactivated', zone);
          this.emitLocal('geofence:deleted', zone);
        } else {
          this.emitLocal('geofence:updated', zone);
        }
      });

      this.socket.on('zone:updated', (data) => {
        const zone = data?.zone || data;
        if (zone?.is_active === false) {
          this.emitLocal('geofence:deactivated', zone);
          this.emitLocal('geofence:deleted', zone);
        } else {
          this.emitLocal('geofence:updated', zone);
        }
      });
    } catch (e) {
      console.error('[Socket] Connection setup error:', e);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emitLocal(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[Socket] Listener error for ${event}:`, err);
        }
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
export default socketService;

