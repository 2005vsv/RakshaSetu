import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.navigationRef = null;
  }

  setNavigationRef(ref) {
    this.navigationRef = ref;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('rakshasetu_alerts', {
          name: 'RakshaSetu Safety Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0284c7',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('rakshasetu_emergency', {
          name: 'RakshaSetu Emergency & Police',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#ef4444',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[NotificationService] Push notification permission not granted');
      }

      // Add response listener when user taps the notification
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.screen && this.navigationRef) {
          try {
            const screen = data.screen;
            if (screen === 'Sos' || screen === 'SosTab') {
              this.navigationRef.navigate('App', { screen: 'SosTab' });
            } else if (screen === 'Alerts' || screen === 'AlertsTab') {
              this.navigationRef.navigate('App', { screen: 'Home', params: { screen: 'AlertsTab' } });
            } else if (screen === 'Map' || screen === 'MapTab' || screen === 'SafetyMap') {
              this.navigationRef.navigate('App', { screen: 'MapTab' });
            } else if (screen === 'Support' || screen === 'SupportScreen') {
              this.navigationRef.navigate('App', { screen: 'Home', params: { screen: 'SupportScreen' } });
            } else {
              this.navigationRef.navigate(screen, data.params || {});
            }
          } catch (navErr) {
            console.error('[NotificationService] Navigation error on notification tap:', navErr);
          }
        }
      });

      this.isInitialized = true;
    } catch (err) {
      console.warn('[NotificationService] Initialization error:', err.message);
    }
  }

  async showNotification({ title, body, data = {}, isEmergency = false }) {
    try {
      await this.initialize();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: String(title || 'RakshaSetu Alert'),
          body: String(body || 'Important safety update available.'),
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: isEmergency ? 'rakshasetu_emergency' : 'rakshasetu_alerts',
          vibrate: isEmergency ? [0, 500, 200, 500] : [0, 250, 250, 250],
        },
        trigger: null, // deliver immediately to Android notification bar
      });
    } catch (e) {
      console.error('[NotificationService] Error scheduling notification:', e);
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
