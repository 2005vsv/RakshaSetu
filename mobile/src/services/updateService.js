import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import notificationService from './notificationService';

// Current installed version in app
export const CURRENT_APP_VERSION = '1.0.0';
export const CURRENT_VERSION_CODE = 1;

const DISMISSED_UPDATE_KEY = '@rakshasetu_dismissed_update';

/**
 * Compare two semver strings: '1.0.0' vs '1.0.1'
 * Returns true if remoteVersion > localVersion
 */
export const isNewerVersion = (remoteVersion, localVersion = CURRENT_APP_VERSION) => {
  try {
    const remoteParts = String(remoteVersion || '').split('.').map((n) => parseInt(n, 10) || 0);
    const localParts = String(localVersion || '').split('.').map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
      const r = remoteParts[i] || 0;
      const l = localParts[i] || 0;
      if (r > l) return true;
      if (r < l) return false;
    }
    return false;
  } catch (_) {
    return false;
  }
};

class UpdateService {
  constructor() {
    this.updateInfo = null;
    this.listeners = new Set();
    this.hasNotifiedInTray = false;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    if (this.updateInfo) {
      callback(this.updateInfo);
    }
    return () => this.listeners.delete(callback);
  }

  notifyListeners(data) {
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.warn('Update listener error:', e);
      }
    });
  }

  async checkForUpdates(isManualCheck = false) {
    try {
      const res = await apiClient.get(API_ENDPOINTS.UPDATES_CHECK);
      const data = res?.data;

      if (!data || !data.latestVersion) {
        return { isAvailable: false, info: null };
      }

      const isAvailable = isNewerVersion(data.latestVersion, CURRENT_APP_VERSION);

      if (isAvailable) {
        this.updateInfo = {
          ...data,
          currentVersion: CURRENT_APP_VERSION,
        };

        // Notify in-app subscribers (opens the Update Available Modal)
        this.notifyListeners(this.updateInfo);

        // Notify Android system tray (Notification Bar)
        if (!this.hasNotifiedInTray || isManualCheck) {
          this.hasNotifiedInTray = true;
          await notificationService.showNotification({
            title: `🚀 ${data.title || 'RakshaSetu Update Available'}`,
            body: `Version ${data.latestVersion} is ready with important fixes & new features. Tap to download!`,
            data: { action: 'APP_UPDATE', url: data.downloadUrl },
          });
        }

        return { isAvailable: true, info: this.updateInfo };
      }

      return { isAvailable: false, info: null, currentVersion: CURRENT_APP_VERSION };
    } catch (err) {
      console.warn('[UpdateService] Check failed:', err.message);
      return { isAvailable: false, error: err.message };
    }
  }

  /**
   * Handle real-time push broadcast from admin/server
   */
  async handleRealtimeUpdateBroadcast(data) {
    if (!data) return;
    const isAvailable = isNewerVersion(data.latestVersion, CURRENT_APP_VERSION);

    if (isAvailable) {
      this.updateInfo = {
        ...data,
        currentVersion: CURRENT_APP_VERSION,
      };

      this.notifyListeners(this.updateInfo);

      await notificationService.showNotification({
        title: `🚀 ${data.title || 'RakshaSetu Update Available'}`,
        body: `Version ${data.latestVersion} is ready. Tap to download the update now!`,
        data: { action: 'APP_UPDATE', url: data.downloadUrl },
      });
    }
  }

  /**
   * Internal In-App APK Download with Live Progress
   * Downloads the APK file internally into app cache and launches the Android installer
   */
  async downloadAndInstallUpdate(url, onProgress) {
    const targetUrl = url || this.updateInfo?.downloadUrl || 'https://github.com/2005vsv/RakshaSetu/releases/download/v1.0.0/RakshaSetu.apk';

    try {
      const FileSystem = require('expo-file-system');
      const destination = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}RakshaSetu_v1.0.1.apk`;

      // Clean old temp APK if present
      try {
        const info = await FileSystem.getInfoAsync(destination);
        if (info.exists) {
          await FileSystem.deleteAsync(destination, { idempotent: true });
        }
      } catch (_) {}

      // Start resumable in-app download
      const downloadResumable = FileSystem.createDownloadResumable(
        targetUrl,
        destination,
        {},
        (dp) => {
          const total = dp.totalBytesExpectedToWrite;
          const written = dp.totalBytesWritten;
          const pct = total > 0 ? written / total : 0;
          if (onProgress) {
            onProgress({
              progress: pct,
              writtenBytes: written,
              totalBytes: total,
              percentage: Math.min(100, Math.round(pct * 100)),
            });
          }
        }
      );

      const res = await downloadResumable.downloadAsync();
      const localUri = res?.uri || destination;

      if (onProgress) {
        onProgress({ progress: 1, percentage: 100, status: 'INSTALLING' });
      }

      // Launch native Android package installer directly on screen
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(localUri);
        await Linking.openURL(contentUri);
      } else {
        await Linking.openURL(targetUrl);
      }

      return { success: true, localUri };
    } catch (err) {
      console.warn('[UpdateService] In-app download fallback to browser:', err.message);
      await Linking.openURL(targetUrl).catch(() => {});
      return { success: false, fallback: true, error: err.message };
    }
  }

  /**
   * Open the direct APK download or GitHub Release page
   */
  async startUpdate(url) {
    return this.downloadAndInstallUpdate(url);
  }
}

export const updateService = new UpdateService();
export default updateService;

