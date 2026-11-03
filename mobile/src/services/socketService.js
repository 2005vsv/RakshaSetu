import { io } from 'socket.io-client';
import { getStoredBaseUrl, getStoredToken } from './apiClient';
import { notificationService } from './notificationService';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  handleIncidentNotification(inc) {
    if (!inc) return;
    const status = String(inc.status || '').toLowerCase();
    const station = inc.assigned_station_name || inc.assignedOfficerName || 'Local Police Unit';

    if (status === 'assigned' || status === 'responding') {
      notificationService.showNotification({
        title: '🚓 Police Response Confirmed!',
        body: `Officer/Station [${station}] has confirmed response and is dispatched to your GPS location!`,
        data: { screen: 'Sos' },
        isEmergency: true,
      });
    } else if (status === 'resolved') {
      notificationService.showNotification({
        title: '✅ SOS Incident Resolved',
        body: 'Authorities have marked your emergency case as safely resolved.',
        data: { screen: 'Sos' },
      });
    }
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
        const inc = data?.incident || data;
        this.emitLocal('incident:update', inc);
        this.handleIncidentNotification(inc);
      });

      this.socket.on('incident:updated', (data) => {
        const inc = data?.incident || data;
        this.emitLocal('incident:update', inc);
        this.handleIncidentNotification(inc);
      });

      this.socket.on('alert:new', (data) => {
        const alert = data?.alert || data;
        this.emitLocal('alert:new', alert);
        if (alert?.severity === 'critical' || alert?.severity === 'high' || alert?.type === 'sos') {
          notificationService.showNotification({
            title: '🚨 Emergency Alert Active',
            body: alert?.message || 'High priority safety alert in your area.',
            data: { screen: 'Alerts' },
            isEmergency: true,
          });
        }
      });

      this.socket.on('alert:updated', (data) => {
        this.emitLocal('alert:new', data?.alert || data);
      });

      this.socket.on('announcement:new', (data) => {
        this.emitLocal('announcement:new', data);
        notificationService.showNotification({
          title: '📢 Safety Announcement',
          body: data?.title ? `${data.title}: ${data.content || ''}` : String(data?.content || data || 'New safety announcement posted by admin.'),
          data: { screen: 'Alerts' },
        });
      });

      this.socket.on('support:new', (data) => {
        this.emitLocal('support:new', data?.request || data);
      });

      this.socket.on('support:updated', (data) => {
        const req = data?.request || data;
        this.emitLocal('support:updated', req);
        notificationService.showNotification({
          title: '💬 Support Response Received',
          body: req?.adminResponse ? `Admin reply: ${req.adminResponse}` : 'The administration has responded to your support request.',
          data: { screen: 'Support' },
        });
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
        const zone = data?.zone || data;
        this.emitLocal('geofence:created', zone);
        notificationService.showNotification({
          title: '⚠️ New Risk Zone Created',
          body: `Admin created "${zone?.name || 'High Risk Zone'}". Avoid entering this perimeter.`,
          data: { screen: 'Map' },
        });
      });

      this.socket.on('zone:created', (data) => {
        const zone = data?.zone || data;
        this.emitLocal('geofence:created', zone);
        notificationService.showNotification({
          title: '⚠️ New Risk Zone Created',
          body: `Admin created "${zone?.name || 'High Risk Zone'}". Avoid entering this perimeter.`,
          data: { screen: 'Map' },
        });
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

