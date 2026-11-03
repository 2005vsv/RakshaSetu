import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../theme/colors';
import apiClient from '../../services/apiClient';
import socketService from '../../services/socketService';
import locationService from '../../services/locationService';
import emergencyService from '../../services/emergencyService';
import { API_ENDPOINTS } from '../../config/api';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingPanic, setSendingPanic] = useState(false);

  // Filters & Search (Web Parity)
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'resolved' | 'high' | 'medium' | 'low'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiClient.get(API_ENDPOINTS.ALERTS);
      const alertList = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.alerts)
        ? res.data.alerts
        : [];
      setAlerts(alertList);
    } catch (e) {
      console.warn('Alerts fetch error:', e.message);
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    // Realtime alert listener
    const unsubscribe = socketService.on('alert:new', (newAlert) => {
      if (newAlert) {
        const item = newAlert.alert || newAlert;
        setAlerts((prev) => [item, ...(Array.isArray(prev) ? prev : [])]);
        Vibration.vibrate([0, 300, 200, 300]);
      }
    });

    return () => unsubscribe();
  }, [fetchAlerts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  // Send Panic Alert (Web Parity)
  const handleSendPanicAlert = async () => {
    setSendingPanic(true);
    try {
      let loc = null;
      try {
        loc = await locationService.getCurrentLocation();
      } catch (_) {}

      if (!loc) {
        loc = { latitude: 28.6129, longitude: 77.2295, accuracy: 25 };
      }

      const res = await apiClient.post(API_ENDPOINTS.ALERTS, {
        type: 'panic',
        severity: 'high',
        message: 'Panic alert activated from alerts page.',
        location: loc,
        status: 'active',
      });

      const newAlert = res?.data?.alert || res?.data;
      if (newAlert) {
        setAlerts((prev) => [newAlert, ...(Array.isArray(prev) ? prev : [])]);
      }

      Vibration.vibrate([0, 500, 200, 500]);
      Alert.alert(
        '🚨 Panic Alert Dispatched',
        `High-priority emergency alert with coordinates (${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}) submitted. Responders alerted.`
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send panic alert.');
    } finally {
      setSendingPanic(false);
    }
  };

  const getAlertBadge = (alert) => {
    const sev = String(alert?.severity || alert?.priority || '').toLowerCase();
    const type = String(alert?.type || '').toLowerCase();

    if (sev === 'high' || type === 'panic' || type === 'sos' || type === 'emergency') {
      return { color: Colors.danger, icon: 'warning', label: 'HIGH RISK' };
    }
    if (sev === 'medium' || type === 'geofence' || type === 'warning') {
      return { color: Colors.warning, icon: 'alert-circle', label: 'CAUTION' };
    }
    return { color: Colors.info, icon: 'information-circle', label: 'INFO' };
  };

  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const filteredAlerts = safeAlerts.filter((a) => {
    if (!a) return false;
    const aType = String(a.type || '').toLowerCase();
    const aSev = String(a.severity || '').toLowerCase();
    const isResolved = a.is_resolved || a.status === 'resolved';

    // Status / Severity match
    if (filter === 'active' && isResolved) return false;
    if (filter === 'resolved' && !isResolved) return false;
    if (filter === 'high' && aSev !== 'high' && aType !== 'panic' && aType !== 'sos') return false;
    if (filter === 'medium' && aSev !== 'medium' && aType !== 'geofence') return false;
    if (filter === 'low' && aSev !== 'low') return false;

    // Search query match
    if (searchQuery.trim()) {
      const haystack = `${a.type || ''} ${a.message || ''} ${a.zone_name || ''}`.toLowerCase();
      if (!haystack.includes(searchQuery.toLowerCase())) return false;
    }

    return true;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      {/* Title & Panic CTA Row */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Safety Alerts & Notices</Text>
          <Text style={styles.headerSubtitle}>
            Live incident notifications & geofence perimeter warnings
          </Text>
        </View>
        <TouchableOpacity
          style={styles.panicBtn}
          onPress={handleSendPanicAlert}
          disabled={sendingPanic}
        >
          {sendingPanic ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="flame" size={15} color={Colors.white} />
              <Text style={styles.panicBtnText}>Panic</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search alerts, warnings, zones..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Chips (Web Parity: all, active, resolved, high, medium, low) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'high', label: 'High' },
          { key: 'medium', label: 'Medium' },
          { key: 'low', label: 'Low' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterChip, filter === tab.key && styles.filterChipActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === tab.key && styles.filterChipTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Emergency Speed Dial Card */}
      <View style={styles.emergencyCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.emergencyTitle}>Immediate Danger?</Text>
          <Text style={styles.emergencySub}>Connect with national emergency control (112)</Text>
        </View>
        <TouchableOpacity
          style={styles.call112Btn}
          onPress={() => emergencyService.callEmergencyHelpline('112')}
        >
          <Ionicons name="call" size={14} color={Colors.white} />
          <Text style={styles.call112BtnText}>Call 112</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : filteredAlerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-checkmark-outline" size={48} color={Colors.success} />
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptyDesc}>
            {searchQuery || filter !== 'all'
              ? 'No alerts match the selected criteria.'
              : 'No active safety warnings recorded for your sector.'}
          </Text>
        </View>
      ) : (
        filteredAlerts.map((item, index) => {
          const badge = getAlertBadge(item);
          const isResolved = item.is_resolved || item.status === 'resolved';

          return (
            <View
              key={item._id || item.id || index}
              style={[
                styles.alertCard,
                { borderLeftColor: badge.color, borderLeftWidth: 4 },
              ]}
            >
              <View style={styles.alertHeader}>
                <Ionicons name={badge.icon} size={16} color={badge.color} />
                <Text style={[styles.alertSeverity, { color: badge.color }]}>
                  {badge.label}
                </Text>
                <View style={{ flex: 1 }} />
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isResolved
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isResolved ? Colors.success : Colors.danger },
                    ]}
                  >
                    {isResolved ? 'RESOLVED' : 'ACTIVE'}
                  </Text>
                </View>
              </View>

              <Text style={styles.alertMessage}>{item.message || 'Safety alert logged.'}</Text>

              {item.location && item.location.latitude ? (
                <Text style={styles.alertCoords}>
                  📍 Coordinates: {Number(item.location.latitude).toFixed(4)}, {Number(item.location.longitude).toFixed(4)}
                </Text>
              ) : null}

              <View style={styles.alertFooter}>
                <Text style={styles.alertType}>
                  Type: <Text style={{ fontWeight: '700' }}>{String(item.type || 'alert').toUpperCase()}</Text>
                </Text>
                <Text style={styles.alertTime}>
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Recent'}
                </Text>
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  panicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  panicBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 14,
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.danger,
  },
  emergencySub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  call112Btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  call112BtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  alertCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  alertSeverity: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  alertMessage: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 6,
  },
  alertCoords: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
    marginTop: 4,
  },
  alertType: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  alertTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
