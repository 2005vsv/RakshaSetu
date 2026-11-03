import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Vibration,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Colors from '../../theme/colors';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import locationService from '../../services/locationService';
import emergencyService from '../../services/emergencyService';
import socketService from '../../services/socketService';

// Helper: Convert GeoJSON polygon coordinates to Leaflet [lat, lng] format
function extractLeafletRings(geometry) {
  if (!geometry) return [];
  const geo = typeof geometry === 'string' ? (() => { try { return JSON.parse(geometry); } catch { return null; } })() : geometry;
  if (!geo || !geo.coordinates) return [];
  try {
    const coords = geo.coordinates;
    const cleanRing = (ring) => {
      if (!Array.isArray(ring)) return [];
      return ring
        .map((pt) => {
          if (!Array.isArray(pt) || pt.length < 2) return null;
          const lng = Number(pt[0]);
          const lat = Number(pt[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return [lat, lng];
        })
        .filter(Boolean);
    };

    if (geo.type === 'Polygon' && Array.isArray(coords)) {
      return coords.map(cleanRing).filter((r) => r.length >= 3);
    }
    if (geo.type === 'MultiPolygon' && Array.isArray(coords)) {
      return coords.flatMap((poly) => (Array.isArray(poly) ? poly.map(cleanRing).filter((r) => r.length >= 3) : []));
    }
  } catch (_) {}
  return [];
}

// Helper: Raycasting point-in-polygon check for GPS coordinates vs zones
function checkPointInZones(coords, zones) {
  if (!coords || !Number.isFinite(Number(coords.latitude)) || !Number.isFinite(Number(coords.longitude)) || !Array.isArray(zones)) {
    return null;
  }
  const lat = Number(coords.latitude);
  const lng = Number(coords.longitude);

  for (const z of zones) {
    const rings = extractLeafletRings(z?.geometry);
    for (const ring of rings) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const lati = ring[i][0];
        const lngi = ring[i][1];
        const latj = ring[j][0];
        const lngj = ring[j][1];
        const crosses =
          lati > lat !== latj > lat &&
          lng < ((lngj - lngi) * (lat - lati)) / (latj - lati || 1e-9) + lngi;
        if (crosses) inside = !inside;
      }
      if (inside) return z;
    }
  }
  return null;
}

// Pure helper: Compute live risk score & warning state reactively
function computeRiskAssessment({ coords, zones, openIncidents, alerts }) {
  const hasOpenSos = Array.isArray(openIncidents) && openIncidents.length > 0;
  const breachedZone = coords ? checkPointInZones(coords, zones) : null;

  const activeAlerts = Array.isArray(alerts)
    ? alerts.filter((a) => !a.is_resolved && a.status !== 'resolved')
    : [];
  const activeCriticalAlerts = activeAlerts.filter((a) =>
    ['critical', 'high', 'sos', 'panic'].includes(String(a.severity || a.type).toLowerCase())
  );
  const activeCautionAlerts = activeAlerts.filter((a) =>
    ['medium', 'warning', 'geofence'].includes(String(a.severity || a.type).toLowerCase())
  );

  let calcScore = 95;
  let riskScore = 5;
  let riskLevel = 'Low Risk';
  let label = 'Safe';
  let color = Colors.success;
  let bg = 'rgba(16, 185, 129, 0.15)';
  let heading = 'Verified Safe Area';
  let description =
    coords && Number.isFinite(Number(coords.latitude)) && Number.isFinite(Number(coords.longitude))
      ? `GPS: ${Number(coords.latitude).toFixed(4)}, ${Number(coords.longitude).toFixed(4)} · Safe perimeter active`
      : 'Perimeter monitoring active. All safety checks passing.';
  let icon = 'shield-checkmark';

  if (hasOpenSos || activeCriticalAlerts.length > 0) {
    calcScore = 20;
    riskScore = 80;
    riskLevel = 'High Risk';
    label = 'Emergency SOS';
    color = Colors.danger;
    bg = 'rgba(239, 68, 68, 0.18)';
    heading = 'Emergency Distress Active';
    description = openIncidents[0]?.message
      ? `SOS: ${openIncidents[0].message}`
      : 'Emergency SOS beacon active. Responders & Police Control Room notified.';
    icon = 'warning';
  } else if (breachedZone && breachedZone.zone_type === 'restricted') {
    calcScore = 35;
    riskScore = 65;
    riskLevel = 'High Risk';
    label = 'Restricted Zone';
    color = Colors.danger;
    bg = 'rgba(239, 68, 68, 0.18)';
    heading = `Restricted Area: ${breachedZone.name}`;
    description = 'You have entered an unauthorized high-risk security boundary. Please exit immediately.';
    icon = 'alert-circle';
  } else if (breachedZone && breachedZone.zone_type === 'risky') {
    calcScore = 60;
    riskScore = 40;
    riskLevel = 'Moderate Risk';
    label = 'Caution Zone';
    color = Colors.warning;
    bg = 'rgba(245, 158, 11, 0.18)';
    heading = `Caution Area: ${breachedZone.name}`;
    description =
      breachedZone.description ||
      'Cautionary terrain or dense perimeter detected. Exercise heightened vigilance.';
    icon = 'shield';
  } else if (activeCautionAlerts.length > 0) {
    calcScore = Math.max(55, 90 - activeCautionAlerts.length * 15);
    riskScore = 100 - calcScore;
    riskLevel = 'Moderate Risk';
    label = 'Caution';
    color = Colors.warning;
    bg = 'rgba(245, 158, 11, 0.18)';
    heading = 'Safety Advisory Active';
    description =
      activeCautionAlerts[0]?.message || 'Cautionary safety alerts logged for your account.';
    icon = 'shield-outline';
  }

  return {
    safetyScore: calcScore,
    riskScore,
    riskLevel,
    label,
    color,
    bg,
    heading,
    description,
    icon,
    insideZone: breachedZone,
    hasActiveSos: hasOpenSos,
  };
}

// Safe date/time formatting helpers
function formatTripDate(val) {
  if (!val) return 'Today';
  const d = new Date(val);
  return isNaN(d.getTime()) ? 'Today' : d.toLocaleDateString();
}

function formatAlertTime(val) {
  if (!val) return 'Recent';
  const d = new Date(val);
  return isNaN(d.getTime())
    ? 'Recent'
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardScreen({ navigation }) {
  const { user, safetyScore, setSafetyScore } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [tripsList, setTripsList] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [allAlerts, setAllAlerts] = useState([]);
  const [openIncidents, setOpenIncidents] = useState([]);
  const [incidentsCount, setIncidentsCount] = useState(0);
  const [currentCoords, setCurrentCoords] = useState(() => locationService.lastLocation || null);
  const [activeZones, setActiveZones] = useState([]);
  const [riskAssessment, setRiskAssessment] = useState({
    safetyScore: 95,
    riskScore: 5,
    riskLevel: 'Low Risk',
    label: 'Safe',
    color: Colors.success,
    bg: 'rgba(16, 185, 129, 0.15)',
    heading: 'Verified Safe Area',
    description: 'Perimeter monitoring active. All zones normal.',
    icon: 'shield-checkmark',
    insideZone: null,
    hasActiveSos: false,
  });

  // Fast concurrent data loading via Promise.allSettled
  const loadDashboardData = useCallback(async () => {
    try {
      const [annRes, tripRes, incRes, zonesRes, alertRes] = await Promise.allSettled([
        apiClient.get(API_ENDPOINTS.ANNOUNCEMENTS),
        apiClient.get(API_ENDPOINTS.TRIPS),
        apiClient.get(API_ENDPOINTS.INCIDENTS),
        apiClient.get(API_ENDPOINTS.ZONES),
        apiClient.get(API_ENDPOINTS.ALERTS),
      ]);

      // 1. Announcements
      if (annRes.status === 'fulfilled') {
        const raw = annRes.value?.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.announcements)
          ? raw.announcements
          : [];
        setAnnouncements(list);
      }

      // 2. Trips
      if (tripRes.status === 'fulfilled') {
        const raw = tripRes.value?.data;
        const trips = Array.isArray(raw) ? raw : Array.isArray(raw?.trips) ? raw.trips : [];
        setTripsList(trips);
        const active = trips.find((t) => t && t.status === 'active') || trips[0];
        setActiveTrip(active || null);
      }

      // 3. Incidents
      let openInc = [];
      if (incRes.status === 'fulfilled') {
        const raw = incRes.value?.data;
        const incList = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.incidents)
          ? raw.incidents
          : [];
        openInc = incList.filter((i) => i && i.status !== 'resolved' && i.status !== 'cancelled');
        setOpenIncidents(openInc);
        setIncidentsCount(openInc.length);
      }

      // 4. Zones
      if (zonesRes.status === 'fulfilled') {
        const raw = zonesRes.value?.data;
        let zonesList = Array.isArray(raw?.zones)
          ? raw.zones
          : Array.isArray(raw)
          ? raw
          : [];
        zonesList = zonesList.filter((z) => z && z.is_active !== false);
        setActiveZones(zonesList);
      }

      // 5. Alerts
      if (alertRes.status === 'fulfilled') {
        const raw = alertRes.value?.data;
        const alertsList = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.alerts)
          ? raw.alerts
          : [];
        setAllAlerts(alertsList);
        setRecentAlerts(alertsList.slice(0, 3));
      }

      // 6. Fast non-blocking GPS update if none cached yet
      if (!locationService.lastLocation) {
        locationService
          .getCurrentLocation(false)
          .then((fresh) => {
            if (
              fresh &&
              Number.isFinite(Number(fresh.latitude)) &&
              Number.isFinite(Number(fresh.longitude))
            ) {
              setCurrentCoords(fresh);
            }
          })
          .catch(() => {});
      }
    } catch (_) {
      // Ignore network errors on polling/refresh
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Subscribe to live GPS coordinates so movement immediately reflects on Dashboard
  useEffect(() => {
    const unsubLocation = locationService.subscribe((freshCoords) => {
      if (
        freshCoords &&
        Number.isFinite(Number(freshCoords.latitude)) &&
        Number.isFinite(Number(freshCoords.longitude))
      ) {
        setCurrentCoords(freshCoords);
      }
    });

    return () => {
      unsubLocation();
    };
  }, []);

  // Reactively recompute risk assessment whenever GPS location, zones, or incidents change
  useEffect(() => {
    const assessment = computeRiskAssessment({
      coords: currentCoords,
      zones: activeZones,
      openIncidents,
      alerts: allAlerts,
    });
    setRiskAssessment(assessment);
    setSafetyScore(assessment.safetyScore);
  }, [currentCoords, activeZones, openIncidents, allAlerts, setSafetyScore]);

  // Initial load and socket subscriptions
  useEffect(() => {
    loadDashboardData();

    // Listen to realtime socket updates
    const unsubAlertNew = socketService.on('alert:new', () => loadDashboardData());
    const unsubAlertUp = socketService.on('alert:updated', () => loadDashboardData());
    const unsubInc = socketService.on('incident:update', () => loadDashboardData());
    const unsubAnn = socketService.on('announcement:new', () => loadDashboardData());
    const unsubGeoCreated = socketService.on('geofence:created', () => loadDashboardData());
    const unsubGeoUpdated = socketService.on('geofence:updated', () => loadDashboardData());
    const unsubGeoDeleted = socketService.on('geofence:deleted', () => loadDashboardData());
    const unsubGeoDeact = socketService.on('geofence:deactivated', () => loadDashboardData());

    // Hook location service geofence warning callback
    locationService.onGeofenceWarning = () => {
      loadDashboardData();
    };

    return () => {
      unsubAlertNew();
      unsubAlertUp();
      unsubInc();
      unsubAnn();
      unsubGeoCreated();
      unsubGeoUpdated();
      unsubGeoDeleted();
      unsubGeoDeact();
      locationService.onGeofenceWarning = null;
    };
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const activeTripsCount = tripsList.filter((t) => t?.status === 'active').length;
  const isLocationShared =
    user?.preferences?.locationSharing !== false && user?.preferences?.shareWithPolice !== false;

  const handleCallNumber = (phone) => {
    if (!phone) return;
    const clean = phone.replace(/[^\d+]/g, '');
    if (!clean) {
      Alert.alert('Invalid Number', 'No valid phone number found for this contact.');
      return;
    }
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Calling Unavailable', `Please dial ${clean} on your phone.`);
    });
  };

  const userInitial = String(user?.name || 'T').trim().slice(0, 1).toUpperCase() || 'T';

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
      {/* Top Profile Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.welcomeText}>Welcome to India,</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {String(user?.name || 'Tourist')}
          </Text>
          <View style={styles.digitalIdTag}>
            <Ionicons name="card-outline" size={12} color={Colors.primary} />
            <Text style={styles.digitalIdText} numberOfLines={1}>
              ID: {String(user?.digitalId || 'VERIFIED')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.headerAiPill}
            onPress={() => navigation.navigate('AiAssistant')}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={15} color="#38bdf8" />
            <Text style={styles.headerAiText}>Ask AI</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileAvatar}
            onPress={() => navigation.navigate('ProfileTab')}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarInitials}>{userInitial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Real-Time Risk & Safety Assessment Hero Card */}
      <View style={[styles.safetyCard, { borderColor: `${riskAssessment.color}45` }]}>
        <View style={styles.safetyLeft}>
          <View style={[styles.scoreCircle, { borderColor: riskAssessment.color }]}>
            <Text style={[styles.scoreNumber, { color: riskAssessment.color }]}>
              {riskAssessment.safetyScore}
            </Text>
            <Text style={styles.scoreMax}>/100</Text>
            <Text style={styles.scoreType}>Safety</Text>
          </View>
        </View>

        <View style={styles.safetyRight}>
          <View style={styles.riskBadgeRow}>
            {/* Risk Status Pill */}
            <View
              style={[
                styles.statusPill,
                { backgroundColor: riskAssessment.bg, borderColor: `${riskAssessment.color}50` },
              ]}
            >
              <Ionicons name={riskAssessment.icon} size={13} color={riskAssessment.color} />
              <Text style={[styles.statusText, { color: riskAssessment.color }]}>
                {riskAssessment.riskLevel} · {riskAssessment.label}
              </Text>
            </View>

            {/* Risk Score Pill */}
            <View style={styles.riskScorePill}>
              <Text style={styles.riskScorePillLabel}>Risk Score:</Text>
              <Text style={[styles.riskScorePillValue, { color: riskAssessment.color }]}>
                {riskAssessment.riskScore}/100
              </Text>
            </View>
          </View>

          <Text style={styles.safetyHeading} numberOfLines={1}>
            {riskAssessment.heading}
          </Text>
          <Text style={styles.safetyDesc} numberOfLines={2}>
            {riskAssessment.description}
          </Text>
        </View>
      </View>

      {/* Key Metric Cards (Web Parity: Active Trips, Open Incidents, Location Sharing) */}
      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Active Trips</Text>
          <Text style={styles.metricValue}>{activeTripsCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Open Incidents</Text>
          <Text style={styles.metricValue}>{incidentsCount}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Location Sharing</Text>
          <Text
            style={[
              styles.metricValueSmall,
              { color: isLocationShared ? Colors.success : Colors.warning },
            ]}
            numberOfLines={1}
          >
            {isLocationShared ? (currentCoords ? 'Shared · Active' : 'On · Syncing') : 'Off'}
          </Text>
        </View>
      </View>

      {/* 🤖 Raksha AI Smart Tourist Safety Assistant Card */}
      <TouchableOpacity
        style={styles.aiAssistantCard}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('AiAssistant')}
      >
        <View style={styles.aiAssistantLeft}>
          <View style={styles.aiAssistantIconWrap}>
            <Ionicons name="sparkles" size={24} color="#38bdf8" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.aiTitleRow}>
              <Text style={styles.aiAssistantTitle}>Ask Raksha AI</Text>
            </View>
            <Text style={styles.aiAssistantDesc}>
              Safety assessment, nearest police & hospitals, local attractions & emergency advice
            </Text>
          </View>
        </View>
        <View style={styles.aiAssistantAction}>
          <Text style={styles.aiAssistantActionText}>Chat</Text>
          <Ionicons name="chevron-forward" size={16} color="#38bdf8" />
        </View>
      </TouchableOpacity>

      {/* Big Emergency SOS Banner Button */}
      <TouchableOpacity
        style={styles.sosButton}
        activeOpacity={0.85}
        onPress={() => {
          try {
            Vibration.vibrate(200);
          } catch (_) {}
          navigation.navigate('SosTab');
        }}
      >
        <View style={styles.sosIconContainer}>
          <Ionicons name="warning" size={32} color={Colors.white} />
        </View>
        <View style={styles.sosTextContainer}>
          <Text style={styles.sosTitle}>EMERGENCY SOS</Text>
          <Text style={styles.sosSubtitle}>Instant alert to police responders & control room</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={Colors.white} />
      </TouchableOpacity>

      {/* Quick Action Navigation Grid (Web Parity: Navigate, My Trips, Contacts) */}
      <Text style={styles.sectionTitle}>Safety Services</Text>
      <View style={styles.gridContainer}>
        <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('MapTab')}>
          <View style={[styles.gridIcon, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
            <Ionicons name="map" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.gridLabel}>Safety Map</Text>
          <Text style={styles.gridSub}>Live GPS & Risk Zones</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('IdTab')}>
          <View style={[styles.gridIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
            <Ionicons name="qr-code" size={24} color={Colors.accentGold} />
          </View>
          <Text style={styles.gridLabel}>Digital ID</Text>
          <Text style={styles.gridSub}>Verifiable Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('TripsTab')}>
          <View style={[styles.gridIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Ionicons name="compass" size={24} color={Colors.success} />
          </View>
          <Text style={styles.gridLabel}>My Trips</Text>
          <Text style={styles.gridSub}>Plan & Track Route</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('AlertsTab')}>
          <View style={[styles.gridIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons name="notifications" size={24} color={Colors.danger} />
          </View>
          <Text style={styles.gridLabel}>Alerts</Text>
          <Text style={styles.gridSub}>{recentAlerts.length} Recorded</Text>
        </TouchableOpacity>
      </View>

      {/* 🗣️ 1-Tap Multilingual Emergency Phrasebook Hero Card */}
      <TouchableOpacity
        style={styles.phrasebookCard}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('EmergencyPhrasebook')}
      >
        <View style={styles.phrasebookLeft}>
          <View style={styles.phrasebookIconWrap}>
            <Ionicons name="volume-high" size={24} color="#38bdf8" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.phrasebookTitleRow}>
              <Text style={styles.phrasebookTitle}>Emergency Voice Board</Text>
              <View style={styles.phrasebookBadge}>
                <Text style={styles.phrasebookBadgeText}>🗣️ Local Speech</Text>
              </View>
            </View>
            <Text style={styles.phrasebookDesc}>
              1-Tap audio speaker in Kannada, Hindi & Marathi for local police, hospitals & lost tourists
            </Text>
            <View style={styles.phrasebookChipsRow}>
              <View style={styles.phrasebookLangChip}>
                <Text style={styles.phrasebookLangChipText}>🟡🔴 ಕನ್ನಡ (Local State)</Text>
              </View>
              <View style={styles.phrasebookLangChip}>
                <Text style={styles.phrasebookLangChipText}>🇮🇳 हिंदी</Text>
              </View>
              <View style={styles.phrasebookLangChip}>
                <Text style={styles.phrasebookLangChipText}>🚩 मराठी</Text>
              </View>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#38bdf8" />
      </TouchableOpacity>

      {/* Safety & Customer Support Card (Web Parity) */}
      <TouchableOpacity
        style={styles.supportBannerCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('SupportScreen')}
      >
        <View style={styles.supportIconWrap}>
          <Ionicons name="chatbubbles" size={24} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.supportBannerTitle}>Safety & Customer Support</Text>
          <Text style={styles.supportBannerSub}>
            Submit inquiries, view operator replies & travel FAQs
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Emergency Contacts Direct Call (Web Parity) */}
      <View style={styles.contactsCard}>
        <View style={styles.contactsCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactsCardTitle}>Emergency Contacts</Text>
            <Text style={styles.contactsCardSub}>One-tap speed dial to trusted contacts or 112</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('ProfileTab')}>
            <Text style={styles.manageText}>Manage</Text>
          </TouchableOpacity>
        </View>

        {/* 112 National Police */}
        <View style={styles.contactRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactName}>National Emergency Services</Text>
            <Text style={styles.contactPhone}>Dial 112 · Police & Medical</Text>
          </View>
          <TouchableOpacity
            style={styles.callSmallBtnDanger}
            onPress={() => emergencyService.callEmergencyHelpline('112')}
          >
            <Ionicons name="call" size={13} color={Colors.white} />
            <Text style={styles.callSmallBtnText}>112</Text>
          </TouchableOpacity>
        </View>

        {/* User Contacts */}
        {Array.isArray(user?.emergencyContacts) && user.emergencyContacts.length > 0 ? (
          user.emergencyContacts.map((c, i) => (
            <View key={i} style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c?.name || 'Contact'}</Text>
                <Text style={styles.contactPhone}>
                  {c?.phone} {c?.relation ? `(${c.relation})` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.callSmallBtn}
                onPress={() => handleCallNumber(c?.phone)}
              >
                <Ionicons name="call" size={13} color={Colors.white} />
                <Text style={styles.callSmallBtnText}>Call</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.noContactsNotice}>
            Add emergency contacts in your Profile to enable direct quick calling.
          </Text>
        )}
      </View>

      {/* Active Trip Widget with "Track Journey" CTA (Web Parity) */}
      {activeTrip ? (
        <View style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <Ionicons name="navigate-circle" size={20} color={Colors.primary} />
            <Text style={styles.tripCardTitle}>
              {activeTrip.status === 'active' ? 'Active Trip' : 'Current Journey'}
            </Text>
            <View style={styles.tripStatusTag}>
              <Text style={styles.tripStatusText}>{activeTrip.status || 'Active'}</Text>
            </View>
          </View>
          <Text style={styles.tripDestination}>
            {activeTrip.startPoint ? `${activeTrip.startPoint} ➔ ` : ''}
            {activeTrip.destination || 'Unspecified Destination'}
          </Text>
          <Text style={styles.tripDates}>
            Mode: {(activeTrip.modeOfTravel || activeTrip.travelMode || 'Car').toUpperCase()} | Starts:{' '}
            {formatTripDate(activeTrip.startDate)}
          </Text>
          <TouchableOpacity
            style={styles.trackJourneyBtn}
            onPress={() => navigation.navigate('MapTab')}
          >
            <Ionicons name="map" size={14} color={Colors.primary} />
            <Text style={styles.trackJourneyText}>Track Journey on Map</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.noTripCard}
          onPress={() => navigation.navigate('TripsTab')}
          activeOpacity={0.8}
        >
          <View style={styles.noTripIconWrap}>
            <Ionicons name="compass-outline" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.noTripTitle}>No Active Trips</Text>
            <Text style={styles.noTripSub}>Plan and register a travel route for safe GPS tracking</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Recent Alerts (Web Parity) */}
      {recentAlerts.length > 0 && (
        <View style={styles.recentAlertsCard}>
          <View style={styles.recentAlertsHeader}>
            <Text style={styles.recentAlertsTitle}>Recent Alerts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AlertsTab')}>
              <Text style={styles.manageText}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentAlerts.map((alert, aIdx) => (
            <View key={alert._id || alert.id || aIdx} style={styles.alertRowItem}>
              <Ionicons
                name={
                  alert.severity === 'high' || alert.type === 'panic'
                    ? 'warning'
                    : 'information-circle'
                }
                size={16}
                color={
                  alert.severity === 'high' || alert.type === 'panic'
                    ? Colors.danger
                    : Colors.warning
                }
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.alertItemMessage} numberOfLines={1}>
                  {alert.message || 'Safety notification'}
                </Text>
                <Text style={styles.alertItemTime}>{formatAlertTime(alert.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Official Safety Announcements */}
      {announcements.length > 0 && (
        <View style={styles.announcementBox}>
          <View style={styles.announcementHeader}>
            <Ionicons name="megaphone-outline" size={18} color={Colors.accentGold} />
            <Text style={styles.announcementTitle}>Official Safety Advisory</Text>
          </View>
          <Text style={styles.announcementText}>
            {announcements[0]?.title}:{' '}
            {announcements[0]?.body || announcements[0]?.content || 'Travel safely.'}
          </Text>
        </View>
      )}

      <View style={{ height: 25 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerAiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerAiText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  aiAssistantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    marginBottom: 16,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  aiAssistantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  aiAssistantIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  aiAssistantTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  aiBadgeGlow: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiBadgeGlowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
  },
  aiAssistantDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  aiAssistantAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  aiAssistantActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  phrasebookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    marginBottom: 16,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  phrasebookLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  phrasebookIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  phrasebookTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  phrasebookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  phrasebookBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  phrasebookBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
  },
  phrasebookDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 8,
  },
  phrasebookChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  phrasebookLangChip: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  phrasebookLangChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  digitalIdTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  digitalIdText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  profileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  safetyCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: 14,
  },
  safetyLeft: {
    marginRight: 14,
  },
  scoreCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  scoreNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  scoreMax: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: -2,
  },
  scoreType: {
    fontSize: 8,
    color: Colors.textMuted,
    fontWeight: '700',
    marginTop: -1,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  safetyRight: {
    flex: 1,
  },
  riskBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  riskScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 4,
  },
  riskScorePillLabel: {
    fontSize: 9.5,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  riskScorePillValue: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  safetyHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
  },
  safetyDesc: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  metricValueSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  sosIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sosTextContainer: {
    flex: 1,
  },
  sosTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.8,
  },
  sosSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  gridItem: {
    width: '48%',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gridIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  gridSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contactsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  contactsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  contactsCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  contactsCardSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  manageText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  contactPhone: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  callSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  callSmallBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  callSmallBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  noContactsNotice: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  tripCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tripCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 6,
    flex: 1,
  },
  tripStatusTag: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tripStatusText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  tripDestination: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  tripDates: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  trackJourneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
    gap: 6,
  },
  trackJourneyText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  noTripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    gap: 12,
  },
  noTripIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTripTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  noTripSub: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  recentAlertsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  recentAlertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentAlertsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  alertRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  alertItemMessage: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  alertItemTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  announcementBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentGold,
    padding: 12,
    borderRadius: 10,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  announcementTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accentGold,
    textTransform: 'uppercase',
  },
  announcementText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 17,
  },
  supportBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    gap: 12,
  },
  supportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  supportBannerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
