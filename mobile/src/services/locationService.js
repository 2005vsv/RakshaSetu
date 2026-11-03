import * as Location from 'expo-location';
import { Platform } from 'react-native';
import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/api';

class LocationService {
  constructor() {
    this.watcher = null;
    this.isTracking = false;
    this.lastLocation = null;
    this.onGeofenceWarning = null;
    this.listeners = new Set();
  }

  /**
   * Subscribe to live location updates across any screen (Map, Dashboard, SOS).
   * Automatically starts tracking if not already running.
   */
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
      // Immediately pass last known location if available
      if (this.lastLocation) {
        try {
          callback(this.lastLocation);
        } catch (_) {}
      }
    }

    if (!this.isTracking) {
      this.startTracking();
    }

    return () => {
      if (typeof callback === 'function') {
        this.listeners.delete(callback);
      }
    };
  }

  /**
   * Alias for subscribe (Backwards and cross-screen compatibility)
   */
  subscribeLocationUpdates(callback) {
    return this.subscribe(callback);
  }

  async requestPermissions() {
    try {
      if (!Location || typeof Location.requestForegroundPermissionsAsync !== 'function') {
        return { granted: false, error: 'Location services unavailable on this device.' };
      }

      // Check existing permission first
      let { status, granted } = await Location.getForegroundPermissionsAsync();
      if (!granted && status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
        granted = req.granted;
      }

      if (!granted && status !== 'granted') {
        return {
          granted: false,
          error: 'Location permission was denied. Please grant "Precise Location" in device settings.',
        };
      }

      // On Android, prompt the user to turn on GPS / Google Location Accuracy if disabled
      if (Platform.OS === 'android' && typeof Location.enableNetworkProviderAsync === 'function') {
        try {
          const provider = await Location.getProviderStatusAsync();
          if (!provider.locationServicesEnabled) {
            await Location.enableNetworkProviderAsync().catch(() => {});
          }
        } catch (_) {}
      }

      return { granted: true, background: false };
    } catch (e) {
      return { granted: false, error: e.message };
    }
  }

  /**
   * Get fresh GPS coordinates with highest precision (BestForNavigation).
   * @param {boolean} highAccuracy - Force satellite GPS fix over cached/cell tower data
   */
  async getCurrentLocation(highAccuracy = true) {
    try {
      const perm = await this.requestPermissions();
      if (!perm.granted) {
        return null;
      }

      if (typeof Location.getCurrentPositionAsync === 'function') {
        const accuracyLevel = highAccuracy
          ? (Location.Accuracy?.BestForNavigation ?? Location.Accuracy?.Highest ?? 6)
          : (Location.Accuracy?.High ?? 4);

        const loc = await Location.getCurrentPositionAsync({
          accuracy: accuracyLevel,
          mayShowUserSettingsDialog: true,
        });

        if (loc?.coords) {
          this.lastLocation = loc.coords;
          return loc.coords;
        }
      }
      return null;
    } catch (e) {
      console.warn('High precision satellite GPS lock timed out, checking last known position:', e.message);
      try {
        if (typeof Location.getLastKnownPositionAsync === 'function') {
          const last = await Location.getLastKnownPositionAsync({
            maxAge: 60000,
          });
          if (last?.coords) {
            this.lastLocation = last.coords;
            return last.coords;
          }
        }
      } catch (_) {}
      return null;
    }
  }

  async syncLocationToServer(coords) {
    if (!coords || !Number.isFinite(Number(coords.latitude)) || !Number.isFinite(Number(coords.longitude))) {
      return null;
    }

    try {
      const accuracy = Number.isFinite(Number(coords.accuracy)) && Number(coords.accuracy) >= 0
        ? Math.round(Number(coords.accuracy))
        : null;
      const speed = Number.isFinite(Number(coords.speed)) && Number(coords.speed) >= 0
        ? Math.round(Number(coords.speed))
        : null;

      const response = await apiClient.post(API_ENDPOINTS.LOCATIONS, {
        latitude: Number(coords.latitude),
        longitude: Number(coords.longitude),
        accuracy,
        speed,
        recordedAt: new Date().toISOString(),
      });

      // The backend returns { point, alerts: warnings } if a geofence danger zone was breached
      const warnings = response.data?.alerts || response.data?.warnings || [];
      if (warnings.length && this.onGeofenceWarning) {
        this.onGeofenceWarning(warnings);
      }

      return response.data;
    } catch (e) {
      console.warn('Failed to sync location to RakshaSetu server:', e.message);
      return null;
    }
  }

  async startTracking(callback, intervalMs = 2000) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
      if (this.lastLocation) {
        try { callback(this.lastLocation); } catch (_) {}
      }
    }

    if (this.isTracking) return;

    try {
      const perm = await this.requestPermissions();
      if (!perm.granted) return;

      if (typeof Location.watchPositionAsync !== 'function') return;

      this.isTracking = true;

      this.watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy?.BestForNavigation ?? Location.Accuracy?.Highest ?? 6,
          timeInterval: intervalMs,
          distanceInterval: 1, // update every 1 meter of movement
          mayShowUserSettingsDialog: true,
        },
        async (location) => {
          if (location?.coords) {
            this.lastLocation = location.coords;
            for (const listener of this.listeners) {
              try {
                listener(location.coords);
              } catch (err) {
                console.warn('Location listener error:', err);
              }
            }
            await this.syncLocationToServer(location.coords);
          }
        }
      );
    } catch (e) {
      console.warn('Failed to start watchPosition:', e.message);
      this.isTracking = false;
    }
  }

  stopTracking() {
    try {
      if (this.watcher && typeof this.watcher.remove === 'function') {
        this.watcher.remove();
      }
    } catch (_) {}
    this.watcher = null;
    this.isTracking = false;
  }
}

export const locationService = new LocationService();
export default locationService;
