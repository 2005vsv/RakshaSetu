import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Vibration,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Colors from '../../theme/colors';
import emergencyService from '../../services/emergencyService';
import locationService from '../../services/locationService';
import socketService from '../../services/socketService';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';

export default function SosScreen({ navigation }) {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeIncident, setActiveIncident] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [lastOfflineBeacon, setLastOfflineBeacon] = useState(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const countdownIntervalRef = useRef(null);

  const isSosActive = Boolean(
    activeIncident &&
    activeIncident.status !== 'resolved' &&
    activeIncident.status !== 'cancelled'
  );

  const syncOfflineNow = async (showFeedback = false) => {
    try {
      setIsSyncing(true);
      const res = await emergencyService.syncOfflineIncidents();
      const count = await emergencyService.getPendingOfflineCount();
      setPendingOfflineCount(count);
      if (showFeedback) {
        if (res?.syncedCount > 0) {
          Alert.alert(
            '✅ Synced to Admin Console',
            `${res.syncedCount} offline distress beacon${res.syncedCount > 1 ? 's' : ''} transmitted to Police Control & Admin Room.`
          );
        } else if (count === 0) {
          Alert.alert('All Synced', 'All emergency records are up to date with the server.');
        } else {
          Alert.alert(
            'Connection Pending',
            'Cannot reach server yet. Your offline emergency beacons are stored locally on device and will sync automatically when mobile data/Wi-Fi is detected.'
          );
        }
      }
    } catch (_) {
      if (showFeedback) {
        Alert.alert('Sync Waiting', 'Network connection not detected yet. Retrying in background...');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch any active incident on mount & listen to realtime updates
  useEffect(() => {
    let isMounted = true;

    const checkActiveIncidents = async () => {
      try {
        const res = await apiClient.get(API_ENDPOINTS.INCIDENTS);
        const incidents = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.incidents)
          ? res.data.incidents
          : [];
        if (isMounted) {
          const open = incidents.find(
            (inc) => inc && inc.status !== 'resolved' && inc.status !== 'cancelled'
          );
          setActiveIncident(open || null);
        }
      } catch (_) {}
    };

    checkActiveIncidents();

    // Load any past offline beacon & pending count
    emergencyService.getOfflineBeacons().then((list) => {
      if (isMounted && Array.isArray(list) && list.length > 0) {
        setLastOfflineBeacon(list[0]);
      }
    });
    emergencyService.getPendingOfflineCount().then((count) => {
      if (isMounted) setPendingOfflineCount(count);
    });

    // Auto-sync any queued offline beacons immediately
    syncOfflineNow(false);

    // Periodic auto-sync every 6 seconds so reconnection immediately uploads queued beacons
    const autoSyncTimer = setInterval(() => {
      syncOfflineNow(false);
    }, 6000);

    // Listen for realtime incident & police confirmation updates
    const handleIncomingIncident = (payload) => {
      const updated = payload?.incident || payload;
      if (!updated) return;
      if (updated.status === 'resolved' || updated.status === 'cancelled') {
        setActiveIncident(null);
      } else {
        setActiveIncident((prev) => {
          if (!prev) return updated;
          return { ...prev, ...updated };
        });

        if (payload?.policeUpdate?.confirmed || updated.policeConfirmed) {
          Vibration.vibrate([0, 800, 300, 800]);
          const offName =
            payload?.policeUpdate?.officerName ||
            updated.assignedPolice?.[0]?.name ||
            'Police Response Officer';
          const stName =
            payload?.policeUpdate?.policeStation ||
            updated.assignedPolice?.[0]?.station ||
            'Belagavi Police';
          const eta =
            payload?.policeUpdate?.etaMinutes || updated.assignedPolice?.[0]?.etaMinutes || 5;

          Alert.alert(
            '🚨 Police Response Confirmed!',
            `Officer ${offName} (${stName}) has confirmed your SOS alert and is en route to you!\n\nEstimated Arrival: ~${eta} mins.\nPlease remain in your current safe location.`
          );
        } else {
          Vibration.vibrate(500);
        }
      }
    };

    const unsub1 = socketService.on('incident:update', handleIncomingIncident);
    const unsub2 = socketService.on('incident:updated', handleIncomingIncident);
    const unsub3 = socketService.on('police:confirmed', handleIncomingIncident);

    // Subscribe to live GPS coordinates for highest precision distress beacon
    const unsubLocation = locationService.subscribe((coords) => {
      if (
        isMounted &&
        coords &&
        Number.isFinite(Number(coords.latitude)) &&
        Number.isFinite(Number(coords.longitude))
      ) {
        setCurrentCoords(coords);
      }
    });

    return () => {
      isMounted = false;
      clearInterval(autoSyncTimer);
      if (typeof unsub1 === 'function') unsub1();
      if (typeof unsub2 === 'function') unsub2();
      if (typeof unsub3 === 'function') unsub3();
      unsubLocation();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const startPanicCountdown = () => {
    if (isSosActive) {
      Alert.alert(
        'SOS Already Active',
        `You already have an active emergency case #${activeIncident.reference || activeIncident._id}.`
      );
      return;
    }

    setCountdown(5);
    Vibration.vibrate([0, 300, 200, 300]);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          triggerEmergencyNow();
          return null;
        }
        Vibration.vibrate(200);
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    Vibration.cancel();
    Alert.alert('Cancelled', 'SOS trigger countdown cancelled.');
  };

  /**
   * Primary Emergency SOS Trigger with Automatic Offline SMS Fallback
   */
  const triggerEmergencyNow = async () => {
    setIsSubmitting(true);
    try {
      // 1. Attempt online server dispatch
      const data = await emergencyService.triggerSOS(
        'Tourist Panic SOS triggered via RakshaSetu Mobile App'
      );
      const inc = data.incident || data;
      setActiveIncident(inc);
      Vibration.vibrate([0, 1000, 500, 1000]);
      if (data.duplicate) {
        Alert.alert(
          'Active Emergency Case',
          `Case #${inc.reference || inc._id} is already open and being handled by emergency responders.`
        );
      } else {
        Alert.alert(
          'SOS Broadcasted!',
          'Your emergency alert and live GPS location have been transmitted to the police control room.'
        );
      }
    } catch (err) {
      // 2. Offline / No Data Detected -> AUTOMATIC FALLBACK TO OFFLINE SMS BEACON
      console.log('Online SOS failed, switching to Offline SMS Fallback Beacon:', err.message);
      await handleTriggerOfflineSmsBeacon(
        'No cellular data or internet network detected. Automatically activating Offline SMS Beacon mode.'
      );
    } finally {
      setIsSubmitting(false);
      setCountdown(null);
    }
  };

  /**
   * 📴 Offline Emergency Mode (SMS Fallback Beacon)
   * Auto-populates native SMS app with exact GPS Google Maps link and Digital ID
   */
  const handleTriggerOfflineSmsBeacon = async (reasonContext = '') => {
    try {
      const beacon = await emergencyService.triggerOfflineSmsBeacon({
        user,
        coords: currentCoords,
        customNote: reasonContext,
      });

      setLastOfflineBeacon(beacon);
      emergencyService.getPendingOfflineCount().then(setPendingOfflineCount);

      const contactName = user?.emergencyContacts?.[0]?.name || 'Emergency Contact';
      const contactPhone = user?.emergencyContacts?.[0]?.phone || '';

      Alert.alert(
        '📴 Offline Distress SMS Beacon Sent',
        `${reasonContext ? `${reasonContext}\n\n` : ''}An emergency distress SMS has been composed directly to your contact ${contactName}${contactPhone ? ` (${contactPhone})` : ''} with your exact GPS Google Maps link and Digital ID.\n\n📡 Control Room Sync: Your beacon is safely recorded on this device and will automatically sync with the Police & Admin Control Room when network is detected.`,
        [
          { text: 'OK', style: 'default' },
          {
            text: '📞 Call Police (112)',
            style: 'destructive',
            onPress: () => emergencyService.callEmergencyHelpline('112'),
          },
        ]
      );
    } catch (offlineErr) {
      Alert.alert('Offline SOS Error', offlineErr.message || 'Please dial 112 directly.');
    }
  };

  const handleCancelActiveIncident = () => {
    Alert.alert(
      'Cancel Emergency SOS',
      'Are you safe now? This will notify responders that the emergency has ended.',
      [
        { text: 'Keep SOS Active', style: 'cancel' },
        {
          text: 'Yes, Cancel Alert',
          style: 'destructive',
          onPress: async () => {
            const incId = activeIncident?._id || activeIncident?.id;
            try {
              if (incId) {
                await emergencyService.cancelSOS(incId, 'Tourist marked as safe');
              }
            } catch (e) {
              console.warn('Cancel SOS error:', e.message);
            } finally {
              setActiveIncident(null);
              Alert.alert('Alert Resolved', 'Your SOS emergency status has been deactivated.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.headerTitle}>Emergency Assistance</Text>
      <Text style={styles.headerSubtitle}>
        Immediate distress beacon & emergency response coordination
      </Text>

      {/* Countdown Overlay or Active SOS Box */}
      {countdown !== null ? (
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownWarn}>DISPATCHING SOS IN</Text>
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNumber}>{countdown}</Text>
          </View>
          <Text style={styles.countdownSub}>Live GPS snapshot will be transmitted</Text>
          <TouchableOpacity style={styles.cancelCountdownBtn} onPress={cancelCountdown}>
            <Text style={styles.cancelCountdownText}>CANCEL (ACCIDENTAL TAP)</Text>
          </TouchableOpacity>
        </View>
      ) : isSosActive ? (
        <View style={styles.activeIncidentBox}>
          <View style={styles.activeHeaderRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.activeTitle}>ACTIVE SOS INCIDENT</Text>
          </View>
          <Text style={styles.incidentRef}>
            Case Ref: {activeIncident.incidentRef || activeIncident.reference || activeIncident._id}
          </Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Current Status:</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{activeIncident.status?.toUpperCase() || 'REPORTED'}</Text>
            </View>
          </View>

          {/* 🚔 POLICE CONFIRMATION BANNER (En Route / Confirmed) */}
          {(activeIncident.policeConfirmed || activeIncident.status === 'responding') && (
            <View style={styles.policeEnRouteCard}>
              <View style={styles.policeEnRouteHeader}>
                <View style={styles.policeSirenBadge}>
                  <Ionicons name="shield-checkmark" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.policeEnRouteKicker}>🚨 POLICE HELP IS ON THE WAY!</Text>
                  <Text style={styles.policeOfficerName}>
                    {activeIncident.assignedPolice?.[0]?.name || activeIncident.assignedName || 'Police Response Officer'}
                  </Text>
                  <Text style={styles.policeStationName}>
                    {activeIncident.assignedPolice?.[0]?.station || 'Belagavi Police Control'}
                  </Text>
                </View>
                <View style={styles.etaPill}>
                  <Text style={styles.etaNumber}>~{activeIncident.assignedPolice?.[0]?.etaMinutes || 5}</Text>
                  <Text style={styles.etaUnit}>MINS</Text>
                </View>
              </View>

              <View style={styles.policeMessageBox}>
                <Ionicons name="chatbubble-ellipses" size={15} color="#3b82f6" />
                <Text style={styles.policeMessageText}>
                  "{activeIncident.policeConfirmationMessage || activeIncident.assignedPolice?.[0]?.policeNote || 'Officer confirmed response. Stay in your location.'}"
                </Text>
              </View>

              <TouchableOpacity
                style={styles.callOfficerBtn}
                activeOpacity={0.85}
                onPress={() =>
                  emergencyService.callEmergencyHelpline(activeIncident.assignedPolice?.[0]?.phone || '112')
                }
              >
                <Ionicons name="call" size={16} color="#fff" />
                <Text style={styles.callOfficerBtnText}>
                  Call Responding Officer ({activeIncident.assignedPolice?.[0]?.phone || '112'})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 👮 POLICE ASSIGNED (Awaiting Confirmation) */}
          {activeIncident.assignedPolice?.length > 0 && !activeIncident.policeConfirmed && activeIncident.status !== 'responding' && (
            <View style={styles.policeAssignedCard}>
              <Ionicons name="shield" size={20} color="#2563eb" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.policeAssignedTitle}>Police Officer Assigned</Text>
                <Text style={styles.policeAssignedSubtitle}>
                  {activeIncident.assignedPolice.map((p) => p.name).join(', ')} ({activeIncident.assignedPolice[0]?.station || 'Belagavi Police'})
                </Text>
                <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: 'bold', marginTop: 2 }}>
                  ⏳ Awaiting field confirmation...
                </Text>
              </View>
            </View>
          )}

          {activeIncident.assignedResponder && !activeIncident.assignedPolice?.length && (
            <View style={styles.responderBox}>
              <Ionicons name="shield" size={18} color={Colors.primary} />
              <Text style={styles.responderText}>
                Assigned Responder: {activeIncident.assignedResponder.name || 'Officer on duty'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cancelIncidentBtn}
            onPress={handleCancelActiveIncident}
          >
            <Text style={styles.cancelIncidentText}>I Am Safe (Cancel SOS)</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Standby Big Panic Button */
        <View style={styles.panicButtonWrapper}>
          <TouchableOpacity
            style={styles.panicCircle}
            activeOpacity={0.8}
            onPress={startPanicCountdown}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="large" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="alert-circle" size={54} color={Colors.white} />
                <Text style={styles.panicText}>TAP FOR SOS</Text>
                <Text style={styles.panicSub}>5s Countdown · Online & Offline</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* 📴 OFFLINE EMERGENCY MODE (SMS FALLBACK BEACON) CARD */}
      <View style={styles.offlineBeaconCard}>
        <View style={styles.offlineBeaconHeader}>
          <View style={styles.offlineIconBadge}>
            <Ionicons name="cloud-offline" size={20} color={Colors.accentGold} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.offlineBeaconTitle}>Offline SMS Fallback Beacon</Text>
            <Text style={styles.offlineBeaconSubtitle}>
              For remote mountains, forests & zero 4G/5G coverage
            </Text>
          </View>
          <View style={styles.offlinePill}>
            <Text style={styles.offlinePillText}>SMS READY</Text>
          </View>
        </View>

        <Text style={styles.offlineBeaconDesc}>
          If mobile internet drops, tapping below bypasses data connections to compile an emergency distress SMS beacon targeted to your emergency contacts and police line:
        </Text>

        {/* Live Auto-Generated Message Preview */}
        <View style={styles.smsPreviewBox}>
          <View style={styles.smsPreviewHeader}>
            <Ionicons name="document-text-outline" size={13} color={Colors.accentGold} />
            <Text style={styles.smsPreviewLabel}>AUTO-GENERATED DISTRESS BEACON:</Text>
          </View>
          <Text style={styles.smsPreviewText}>
            {emergencyService.formatDistressSms(user, currentCoords)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.offlineActionBtn}
          activeOpacity={0.85}
          onPress={() =>
            handleTriggerOfflineSmsBeacon('Direct tourist trigger in offline zero-data zone')
          }
        >
          <Ionicons name="paper-plane" size={17} color={Colors.white} />
          <Text style={styles.offlineActionBtnText}>Send Offline SMS Beacon (No Internet)</Text>
        </TouchableOpacity>

        {/* Sync Status & Action Bar */}
        <View style={styles.syncContainer}>
          <View style={styles.syncInfoRow}>
            <Ionicons
              name={pendingOfflineCount > 0 ? 'cloud-upload' : 'checkmark-done-circle'}
              size={18}
              color={pendingOfflineCount > 0 ? '#f59e0b' : Colors.success}
            />
            <Text style={styles.syncInfoText}>
              {pendingOfflineCount > 0
                ? `${pendingOfflineCount} offline beacon(s) queued · Auto-syncs when online`
                : 'All offline beacons synced with Admin Console'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.syncBtn,
              pendingOfflineCount > 0 ? styles.syncBtnActive : styles.syncBtnSubtle,
            ]}
            activeOpacity={0.8}
            onPress={() => syncOfflineNow(true)}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={15} color="#fff" />
                <Text style={styles.syncBtnText}>
                  {pendingOfflineCount > 0 ? 'Sync to Admin Console Now' : 'Check Sync Status'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {lastOfflineBeacon && (
          <View style={styles.dispatchedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.dispatchedText}>
              Last SMS beacon prepared at {lastOfflineBeacon.dispatchedAt}.
            </Text>
          </View>
        )}
      </View>

      {/* 🗣️ Local Language Emergency Voice Board */}
      <TouchableOpacity
        style={styles.voiceBoardCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('EmergencyPhrasebook')}
      >
        <View style={styles.voiceBoardIconWrap}>
          <Ionicons name="volume-high" size={22} color="#38bdf8" />
        </View>
        <View style={styles.voiceBoardDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={styles.voiceBoardTitle}>Speak to Locals (Voice Board)</Text>
            <View style={styles.voiceBoardBadge}>
              <Text style={styles.voiceBoardBadgeText}>🗣️ Audio</Text>
            </View>
          </View>
          <Text style={styles.voiceBoardDesc}>
            1-Tap speech in Kannada (Local), Hindi & Marathi to alert police, doctors & passersby
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#38bdf8" />
      </TouchableOpacity>

      {/* 🤖 Ask Raksha AI Safety Assistant */}
      <TouchableOpacity
        style={styles.aiHelpCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AiAssistant')}
      >
        <View style={styles.aiHelpIconWrap}>
          <Ionicons name="sparkles" size={22} color="#a855f7" />
        </View>
        <View style={styles.aiHelpDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={styles.aiHelpTitle}>Emergency AI Assistant</Text>
            <View style={styles.aiHelpBadge}>
              <Text style={styles.aiHelpBadgeText}>🤖 24/7 AI</Text>
            </View>
          </View>
          <Text style={styles.aiHelpDesc}>
            Ask what to do during emergencies, locate nearest hospitals, or get immediate guidance
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#a855f7" />
      </TouchableOpacity>

      {/* Emergency Dialing Cards */}
      <Text style={styles.sectionHeader}>Instant Helplines</Text>

      <TouchableOpacity
        style={styles.helplineCard}
        onPress={() => emergencyService.callEmergencyHelpline('112')}
      >
        <View style={[styles.helplineIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
          <Ionicons name="call" size={24} color={Colors.danger} />
        </View>
        <View style={styles.helplineDetails}>
          <Text style={styles.helplineNumber}>112 (National Emergency)</Text>
          <Text style={styles.helplineDesc}>Police, Ambulance, Fire & Disaster Services</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.helplineCard}
        onPress={() => emergencyService.callEmergencyHelpline('1363')}
      >
        <View style={[styles.helplineIcon, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
          <Ionicons name="compass" size={24} color={Colors.primary} />
        </View>
        <View style={styles.helplineDetails}>
          <Text style={styles.helplineNumber}>1363 (Tourist Helpline)</Text>
          <Text style={styles.helplineDesc}>Ministry of Tourism Multi-lingual Helpline</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  aiHelpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#a855f7',
    marginBottom: 18,
    gap: 12,
  },
  aiHelpIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHelpDetails: {
    flex: 1,
  },
  aiHelpTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  aiHelpBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: '#a855f7',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiHelpBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c084fc',
  },
  aiHelpDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  voiceBoardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    marginBottom: 18,
    gap: 12,
  },
  voiceBoardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBoardDetails: {
    flex: 1,
  },
  voiceBoardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  voiceBoardBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  voiceBoardBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38bdf8',
  },
  voiceBoardDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  panicButtonWrapper: {
    alignItems: 'center',
    marginVertical: 16,
  },
  panicCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 6,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  panicText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
    marginTop: 6,
  },
  panicSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    fontWeight: '600',
  },
  countdownContainer: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.danger,
    marginVertical: 20,
  },
  countdownWarn: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.danger,
    letterSpacing: 0.8,
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  countdownNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.white,
  },
  countdownSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  cancelCountdownBtn: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelCountdownText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  activeIncidentBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.danger,
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.danger,
    letterSpacing: 0.5,
  },
  incidentRef: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  statusLabel: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  responderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  responderText: {
    fontSize: 13,
    color: Colors.text,
  },
  cancelIncidentBtn: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelIncidentText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  offlineBeaconCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    marginBottom: 22,
  },
  offlineBeaconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  offlineIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBeaconTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.text,
  },
  offlineBeaconSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  offlinePill: {
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderWidth: 1,
    borderColor: Colors.accentGold,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  offlinePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.accentGold,
    letterSpacing: 0.5,
  },
  offlineBeaconDesc: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
  },
  smsPreviewBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  smsPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  smsPreviewLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.accentGold,
    letterSpacing: 0.8,
  },
  smsPreviewText: {
    fontSize: 11.5,
    color: '#cbd5e1',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  offlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b45309',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  offlineActionBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dispatchedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  dispatchedText: {
    fontSize: 10.5,
    color: Colors.success,
    fontWeight: '600',
    flex: 1,
  },
  syncContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  syncInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  syncInfoText: {
    fontSize: 11,
    color: '#e2e8f0',
    fontWeight: '600',
    flex: 1,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  syncBtnActive: {
    backgroundColor: '#d97706',
  },
  syncBtnSubtle: {
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
  },
  syncBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  policeEnRouteCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#3b82f6',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  policeEnRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  policeSirenBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policeEnRouteKicker: {
    fontSize: 10,
    fontWeight: '900',
    color: '#60a5fa',
    letterSpacing: 0.8,
  },
  policeOfficerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  policeStationName: {
    fontSize: 11,
    color: '#94a3b8',
  },
  etaPill: {
    backgroundColor: '#1e3a8a',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  etaNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#60a5fa',
  },
  etaUnit: {
    fontSize: 9,
    fontWeight: '800',
    color: '#93c5fd',
  },
  policeMessageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  policeMessageText: {
    flex: 1,
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  callOfficerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  callOfficerBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  policeAssignedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    marginBottom: 14,
  },
  policeAssignedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#60a5fa',
  },
  policeAssignedSubtitle: {
    fontSize: 11.5,
    color: '#cbd5e1',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  helplineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  helplineIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  helplineDetails: {
    flex: 1,
  },
  helplineNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  helplineDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
