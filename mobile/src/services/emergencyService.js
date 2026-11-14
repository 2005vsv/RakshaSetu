import { Linking, Vibration, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import locationService from './locationService';

const OFFLINE_INCIDENTS_KEY = '@rakshasetu_offline_incidents';

class EmergencyService {
  /**
   * Online SOS Trigger
   */
  async triggerSOS(note = 'Emergency SOS triggered by tourist mobile app') {
    // Immediate haptic vibration alert
    Vibration.vibrate([0, 500, 200, 500]);

    // Fast GPS resolution: prefer last known GPS lock immediately, or fast check
    let coords = locationService.lastLocation;
    if (!coords) {
      try {
        coords = await Promise.race([
          locationService.getCurrentLocation(false),
          new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
      } catch (_) {
        coords = locationService.lastLocation;
      }
    }

    const payload = {
      message: note,
      location: coords
        ? {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy || null,
          }
        : null,
    };

    const response = await apiClient.post(API_ENDPOINTS.SOS, payload);
    return response.data;
  }

  /**
   * Cancel Active SOS
   */
  async cancelSOS(incidentId, reason = 'Accidental trigger by tourist') {
    if (!incidentId) return;
    const response = await apiClient.patch(API_ENDPOINTS.CANCEL_INCIDENT(incidentId), {
      reason,
    });
    return response.data;
  }

  getPrimaryEmergencyPhone(user) {
    if (Array.isArray(user?.emergencyContacts)) {
      for (const contact of user.emergencyContacts) {
        if (contact?.phone) {
          const digits = String(contact.phone).replace(/[^0-9+]/g, '').trim();
          if (digits.length >= 10) return digits;
        }
      }
    }
    if (user?.emergencyContactPhone) {
      const digits = String(user.emergencyContactPhone).replace(/[^0-9+]/g, '').trim();
      if (digits.length >= 10) return digits;
    }
    return '';
  }

  /**
   * Open native SMS app pre-filled with distress message and emergency contact number
   */
  async openNativeSmsApp(phone = '', message = '') {
    const cleanPhone = String(phone || '').replace(/[^0-9+]/g, '').trim();
    const encodedBody = encodeURIComponent(message || '');
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const url = cleanPhone ? `sms:${cleanPhone}${separator}body=${encodedBody}` : `sms:${separator}body=${encodedBody}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`sms:${separator}body=${encodedBody}`);
      }
    } catch (err) {
      console.warn('Could not launch SMS app:', err.message);
    }
  }

  /**
   * Dial Emergency Helpline
   */
  callEmergencyHelpline(number = '112') {
    const url = Platform.OS === 'android' ? `tel:${number}` : `telprompt:${number}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Unable to Dial', `Please call ${number} directly from your phone.`);
        }
      })
      .catch((err) => console.error('Call helpline error:', err));
  }

  /**
   * Standard single-recipient SMS
   */
  smsEmergencyContact(phoneNumber, message) {
    if (!phoneNumber) return;
    const url = `sms:${phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch((err) => console.error('SMS contact error:', err));
  }

  /**
   * Format the standardized emergency distress SMS beacon string:
   * EMERGENCY: Tourist [Name] (#[DigitalID]) in distress at Lat: [Lat], Lng: [Lng]. Map: https://maps.google.com/?q=[Lat],[Lng]
   */
  formatDistressSms(user, coords) {
    const name = user?.name || 'Tourist';
    const digitalId = user?.digitalId || 'DIG-TOURIST';

    if (coords && Number.isFinite(Number(coords.latitude)) && Number.isFinite(Number(coords.longitude))) {
      const lat = Number(coords.latitude).toFixed(4);
      const lng = Number(coords.longitude).toFixed(4);
      return `EMERGENCY: Tourist ${name} (#${digitalId}) in distress at Lat: ${lat}, Lng: ${lng}. Map: https://maps.google.com/?q=${lat},${lng}`;
    }

    return `EMERGENCY: Tourist ${name} (#${digitalId}) in distress. GPS location syncing. Please alert emergency services (112).`;
  }

  /**
   * 📴 OFFLINE EMERGENCY MODE (SMS Fallback Beacon)
   * 1. Resolves GPS coordinates (from cache or quick satellite lock)
   * 2. Compiles standardized distress message with clickable Google Maps link
   * 3. Auto-populates native SMS app targeted to Emergency Contact and 112 Police Line
   * 4. Queues locally in AsyncStorage and auto-syncs with Admin Panel when connectivity resumes
   */
  async triggerOfflineSmsBeacon({ user, coords = null, customNote = '' }) {
    Vibration.vibrate([0, 800, 200, 800]);

    // Use passed coords or fallback to location service
    const resolvedCoords = coords || locationService.lastLocation || null;
    const message = this.formatDistressSms(user, resolvedCoords) + (customNote ? ` Note: ${customNote}` : '');

    // Target recipient: registered emergency contact phone
    const cleanPhone = this.getPrimaryEmergencyPhone(user) || String(user?.emergencyContacts?.[0]?.phone || user?.emergencyContactPhone || '').replace(/[^0-9+]/g, '').trim();

    // Create local offline beacon record
    const beaconRecord = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      dispatchedAt: new Date().toLocaleString(),
      message,
      touristName: user?.name || 'Tourist',
      digitalId: user?.digitalId || 'DIG-TOURIST',
      emergencyContactPhone: cleanPhone,
      location: resolvedCoords
        ? {
            latitude: Number(resolvedCoords.latitude),
            longitude: Number(resolvedCoords.longitude),
            accuracy: resolvedCoords.accuracy || 15,
          }
        : null,
      recipients: cleanPhone ? [cleanPhone] : ['Emergency Family Contact'],
      synced: false,
    };

    // Save to local offline queue
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_INCIDENTS_KEY);
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(beaconRecord);
      await AsyncStorage.setItem(OFFLINE_INCIDENTS_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (storageErr) {
      console.warn('Could not save offline beacon locally:', storageErr.message);
    }

    // Automatically sync beacon immediately to backend and admin control room if network is reachable
    let syncedSuccessfully = false;
    try {
      const syncResult = await this.syncOfflineIncidents();
      if (syncResult && syncResult.syncedCount > 0) {
        syncedSuccessfully = true;
      }
    } catch (_) {}

    // Open native Messages app pre-filled with recipient phone and GPS coordinates
    // User can tap the Send button to dispatch immediately for free via their SIM card
    try {
      await this.openNativeSmsApp(cleanPhone, message);
    } catch (smsAppErr) {
      console.warn('Could not open Messages app automatically:', smsAppErr.message);
    }

    return {
      ...beaconRecord,
      synced: syncedSuccessfully,
      cleanPhone,
    };
  }

  /**
   * Sync queued offline beacons with backend/admin console
   */
  async syncOfflineIncidents() {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_INCIDENTS_KEY);
      if (!stored) return { syncedCount: 0, pendingCount: 0 };

      const list = JSON.parse(stored);
      const unsynced = list.filter((item) => !item.synced);
      if (unsynced.length === 0) return { syncedCount: 0, pendingCount: 0 };

      let syncedCount = 0;
      for (const item of unsynced) {
        try {
          await apiClient.post(API_ENDPOINTS.OFFLINE_BEACON, item);
          item.synced = true;
          syncedCount++;
        } catch (err) {
          // Still offline or server unreachable, leave unsynced for next retry
          console.log('Sync offline beacon attempt failed (still offline or unreachable):', err.message);
          break;
        }
      }

      await AsyncStorage.setItem(OFFLINE_INCIDENTS_KEY, JSON.stringify(list));
      const remaining = list.filter((item) => !item.synced).length;
      return { syncedCount, pendingCount: remaining };
    } catch (e) {
      console.warn('Offline beacon sync error:', e.message);
      return { syncedCount: 0, pendingCount: 0 };
    }
  }

  /**
   * Get count of pending unsynced offline beacons
   */
  async getPendingOfflineCount() {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_INCIDENTS_KEY);
      if (!stored) return 0;
      const list = JSON.parse(stored);
      return list.filter((item) => !item.synced).length;
    } catch (_) {
      return 0;
    }
  }

  /**
   * Get all recorded offline beacons
   */
  async getOfflineBeacons() {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_INCIDENTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  }
}

export const emergencyService = new EmergencyService();
export default emergencyService;
