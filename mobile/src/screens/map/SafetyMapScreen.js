import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Dimensions,
  Vibration,
  Platform,
  Linking,
} from 'react-native';
import WebView from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Colors from '../../theme/colors';
import locationService from '../../services/locationService';
import safeHavenService from '../../services/safeHavenService';
import apiClient from '../../services/apiClient';
import emergencyService from '../../services/emergencyService';
import socketService from '../../services/socketService';
import { API_ENDPOINTS } from '../../config/api';
import { STATIC_LEAFLET_HTML } from './leafletTemplate';
import geocodingService from '../../services/geocodingService';

const { width } = Dimensions.get('window');
const RADAR_SIZE = Math.min(width - 40, 280);

// Helper: Haversine distance in kilometers
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) {
    return null;
  }
  const R = 6371; // Earth's radius in km
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
    Math.cos((nLat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
  } catch (_) { }
  return [];
}

// Helper: Compute polygon center
function getZoneCenter(geometry) {
  if (!geometry) return null;
  const rings = extractLeafletRings(geometry);
  if (rings.length > 0 && rings[0].length >= 3) {
    const ring = rings[0];
    let sumLat = 0;
    let sumLng = 0;
    for (const pt of ring) {
      sumLat += pt[0];
      sumLng += pt[1];
    }
    return { latitude: sumLat / ring.length, longitude: sumLng / ring.length };
  }
  return null;
}

// Helper: Raycasting point-in-polygon check
function checkPointInZones(coords, zones) {
  if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) || !Array.isArray(zones)) {
    return null;
  }
  const lat = coords.latitude;
  const lng = coords.longitude;

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

// Helper: Resolve landmark name or string coordinates to latitude & longitude
function resolveDestinationCoords(destStr) {
  if (!destStr) return null;
  const str = String(destStr).trim();

  // 1. Check numeric coordinates e.g. "15.8340, 74.5047"
  const coordMatch = str.match(/([0-9]+\.[0-9]+)[,\s]+([0-9]+\.[0-9]+)/);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lng = Number(coordMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 2. Check known safe haven names or landmarks in Belagavi
  const s = str.toLowerCase();
  if (s.includes('tilakwadi') || s.includes('guruwar peth')) {
    return { latitude: 15.835939, longitude: 74.501521 };
  }
  if (s.includes('udyambag police')) {
    return { latitude: 15.814980, longitude: 74.491220 };
  }
  if (s.includes('udyambag') || s.includes('rajaram nagar')) {
    return { latitude: 15.814500, longitude: 74.492000 };
  }
  if (s.includes('kle') || s.includes('centenary')) {
    return { latitude: 15.823900, longitude: 74.505500 };
  }
  if (s.includes('civil hospital') || s.includes('bims')) {
    return { latitude: 15.859000, longitude: 74.512000 };
  }
  if (s.includes('fort') || s.includes('belagavi fort')) {
    return { latitude: 15.858800, longitude: 74.521500 };
  }
  if (s.includes('railway') || s.includes('station')) {
    return { latitude: 15.858000, longitude: 74.509000 };
  }
  if (s.includes('khade bazar') || s.includes('market')) {
    return { latitude: 15.855000, longitude: 74.515000 };
  }

  return { latitude: 15.835939, longitude: 74.501521 };
}

export default function SafetyMapScreen({ navigation }) {
  const { user } = useAuth();
  const userInitial = String(user?.name || 'Tourist').trim().slice(0, 1).toUpperCase() || 'T';

  const [activeViewMode, setActiveViewMode] = useState('map'); // 'map' | 'radar'
  const [coords, setCoords] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Web parity features
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [activeZoneAlert, setActiveZoneAlert] = useState(null);
  const [loggingAlert, setLoggingAlert] = useState(false);

  // 🏥 1-Tap "Safe Havens" Locator State
  const [safeHavens, setSafeHavens] = useState([]);
  const [isFindingHavens, setIsFindingHavens] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'police' | 'hospital' | 'pharmacy'
  const [showHavensDrawer, setShowHavensDrawer] = useState(false);
  const [selectedHavenId, setSelectedHavenId] = useState(null);

  // 🗺️ Active Trip & Safe Route State
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripRouteData, setTripRouteData] = useState(null);
  const [loadingTripRoute, setLoadingTripRoute] = useState(false);
  const [showTripRegisterModal, setShowTripRegisterModal] = useState(false);
  const [tripDestInput, setTripDestInput] = useState('');
  const [tripStartInput, setTripStartInput] = useState('');
  const [tripModeInput, setTripModeInput] = useState('driving');
  const [registeringTrip, setRegisteringTrip] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [loadingDestSearch, setLoadingDestSearch] = useState(false);
  const [loadingStartSearch, setLoadingStartSearch] = useState(false);
  const destSearchTimer = useRef(null);
  const startSearchTimer = useRef(null);

  const webViewRef = useRef(null);
  const hasCenteredUser = useRef(false);

  // Radar HUD animations
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim1 = Animated.loop(
      Animated.timing(pulseAnim1, {
        toValue: 1,
        duration: 2500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(pulseAnim2, {
          toValue: 1,
          duration: 2500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const sweep = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    anim1.start();
    anim2.start();
    sweep.start();

    return () => {
      anim1.stop();
      anim2.stop();
      sweep.stop();
    };
  }, [pulseAnim1, pulseAnim2, sweepAnim]);

  // Load Zones & Initial Location
  const loadMapData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Current Location
      try {
        const loc = await locationService.getCurrentLocation();
        if (loc) {
          setCoords(loc);
        }
      } catch (e) {
        console.warn('GPS location error:', e.message);
      }

      // 2. Geofence Zones from backend
      try {
        const zoneRes = await apiClient.get(API_ENDPOINTS.ZONES);
        const zoneList = Array.isArray(zoneRes?.data)
          ? zoneRes.data
          : Array.isArray(zoneRes?.data?.zones)
            ? zoneRes.data.zones
            : [];
        setZones(zoneList);
      } catch (e) {
        console.warn('Zone fetch error:', e.message);
        setZones([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Continuously listen to GPS telemetry and update map marker as user walks
  useEffect(() => {
    const unsubscribe = locationService.subscribe((freshCoords) => {
      if (freshCoords && Number.isFinite(Number(freshCoords.latitude)) && Number.isFinite(Number(freshCoords.longitude))) {
        setCoords(freshCoords);
        if (mapReady) {
          updateMapMarker(freshCoords.latitude, freshCoords.longitude, freshCoords.accuracy, !hasCenteredUser.current);
          if (!hasCenteredUser.current) {
            hasCenteredUser.current = true;
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [mapReady, updateMapMarker]);

  // Fetch active trip from database
  const fetchActiveTrip = useCallback(async () => {
    try {
      const res = await apiClient.get(API_ENDPOINTS.TRIPS);
      const tripList = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.trips)
        ? res.data.trips
        : [];
      const currentActive = tripList.find((t) => t && t.status === 'active');
      setActiveTrip(currentActive || null);

      if (!currentActive) {
        setTripRouteData(null);
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            if (typeof window.clearTripRoute === 'function') {
              window.clearTripRoute();
            }
            true;
          `);
        }
      }
    } catch (e) {
      console.warn('Trips fetch error in SafetyMap:', e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchActiveTrip();
    }, [fetchActiveTrip])
  );

  // Compute and inject shortest safe route whenever activeTrip and coords are present
  useEffect(() => {
    if (!activeTrip || !mapReady) return;

    let isCancelled = false;

    const calculateSafeRoute = async () => {
      setLoadingTripRoute(true);
      try {
        // 1. Determine origin coordinates (custom start location vs current GPS location)
        const hasCustomStart =
          activeTrip.startPoint &&
          !activeTrip.startPoint.toLowerCase().includes('current') &&
          !activeTrip.startPoint.toLowerCase().includes('live');

        let originCoords = coords;
        if (hasCustomStart) {
          originCoords = await geocodingService.resolveCoordinates(activeTrip.startPoint, coords);
        }

        if (!originCoords || !Number.isFinite(originCoords.latitude) || !Number.isFinite(originCoords.longitude)) {
          return;
        }

        // 2. Determine destination coordinates
        let destCoords = await geocodingService.resolveCoordinates(activeTrip.destination, null);
        if (!destCoords) {
          destCoords = resolveDestinationCoords(activeTrip.destination);
        }

        if (!destCoords || !Number.isFinite(destCoords.latitude) || !Number.isFinite(destCoords.longitude)) {
          return;
        }

        // 3. Compute risk-avoiding road route via OSRM backend
        const route = await safeHavenService.getRoadRoute(
          originCoords.latitude,
          originCoords.longitude,
          destCoords.latitude,
          destCoords.longitude,
          activeTrip.modeOfTravel === 'trekking' ? 'walking' : 'driving'
        );

        if (isCancelled || !route || !route.geometry) return;
        setTripRouteData(route);

        // 4. Inject route, destination pin, and optional start pin into Leaflet WebView
        if (webViewRef.current) {
          const js = `
            if (typeof window.renderTripRoute === 'function') {
              window.renderTripRoute(
                ${JSON.stringify(route.geometry.coordinates)},
                ${JSON.stringify(activeTrip.destination)},
                ${route.hazardAvoidanceActive ? 'true' : 'false'},
                ${JSON.stringify(route.avoidedHazards || [])},
                ${destCoords.latitude},
                ${destCoords.longitude},
                ${hasCustomStart ? originCoords.latitude : 'null'},
                ${hasCustomStart ? originCoords.longitude : 'null'},
                ${JSON.stringify(hasCustomStart ? activeTrip.startPoint : '')}
              );
            }
            true;
          `;
          webViewRef.current.injectJavaScript(js);
        }
      } catch (err) {
        console.warn('Trip safe route calculation warning:', err.message);
      } finally {
        if (!isCancelled) setLoadingTripRoute(false);
      }
    };

    calculateSafeRoute();

    return () => {
      isCancelled = true;
    };
  }, [activeTrip, coords, mapReady]);

  // Complete active trip and close route direction on map
  const handleCompleteActiveTrip = async () => {
    if (!activeTrip) return;
    const tripId = activeTrip._id || activeTrip.id;
    try {
      if (tripId) {
        await apiClient.patch(API_ENDPOINTS.TRIP_DETAIL(tripId), { status: 'completed' });
      }
      setActiveTrip(null);
      setTripRouteData(null);

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (typeof window.clearTripRoute === 'function') {
            window.clearTripRoute();
          }
          true;
        `);
      }
      Alert.alert(
        'Trip Completed 🎉',
        'You have arrived at your destination safely. The route direction has been closed on your safety map.'
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not complete trip.');
    }
  };

  // Autocomplete search handlers for Destination and Start Location
  const handleDestChangeText = (text) => {
    setTripDestInput(text);
    if (destSearchTimer.current) clearTimeout(destSearchTimer.current);
    if (!text || text.trim().length < 2) {
      setDestSuggestions([]);
      setLoadingDestSearch(false);
      return;
    }
    setLoadingDestSearch(true);
    destSearchTimer.current = setTimeout(async () => {
      try {
        const items = await geocodingService.searchPlaces(text);
        setDestSuggestions(items || []);
      } catch (_) {
        setDestSuggestions([]);
      } finally {
        setLoadingDestSearch(false);
      }
    }, 280);
  };

  const handleStartChangeText = (text) => {
    setTripStartInput(text);
    if (startSearchTimer.current) clearTimeout(startSearchTimer.current);
    if (!text || text.trim().length < 2) {
      setStartSuggestions([]);
      setLoadingStartSearch(false);
      return;
    }
    setLoadingStartSearch(true);
    startSearchTimer.current = setTimeout(async () => {
      try {
        const items = await geocodingService.searchPlaces(text);
        setStartSuggestions(items || []);
      } catch (_) {
        setStartSuggestions([]);
      } finally {
        setLoadingStartSearch(false);
      }
    }, 280);
  };

  const handleSelectDestSuggestion = (item) => {
    setTripDestInput(item.displayName || item.name);
    setDestSuggestions([]);
  };

  const handleSelectStartSuggestion = (item) => {
    setTripStartInput(item.displayName || item.name);
    setStartSuggestions([]);
  };

  const handleSelectQuickChip = (dest) => {
    setTripDestInput(dest);
    setDestSuggestions([]);
  };

    // Register a new safe trip directly from Safety Map
  const handleRegisterTripFromMap = async () => {
    if (!tripDestInput.trim()) {
      Alert.alert('Required', 'Please enter a trip destination.');
      return;
    }

    setRegisteringTrip(true);
    try {
      const payload = {
        startPoint: tripStartInput.trim() || 'Current Live Location',
        destination: tripDestInput.trim(),
        modeOfTravel: tripModeInput,
        status: 'active',
        startDate: new Date().toISOString(),
      };

      const res = await apiClient.post(API_ENDPOINTS.TRIPS, payload);
      const newTrip = res.data;
      setActiveTrip(newTrip);
      setShowTripRegisterModal(false);
      setTripDestInput('');
      setTripStartInput('');
      setDestSuggestions([]);
      setStartSuggestions([]);

      Alert.alert(
        'Trip Registered & Active 🛣️',
        `Safe journey! Computing the shortest safe route avoiding danger zones to ${newTrip.destination}.`
      );
    } catch (e) {
      Alert.alert('Registration Error', e.message || 'Could not register trip.');
    } finally {
      setRegisteringTrip(false);
    }
  };

  // Safe zones memo
  const safeZones = useMemo(() => (Array.isArray(zones) ? zones : []), [zones]);

  // Check geofence status whenever coords or zones change
  useEffect(() => {
    if (coords && safeZones.length > 0) {
      const entered = checkPointInZones(coords, safeZones);
      setActiveZoneAlert(entered || null);
    }
  }, [coords, safeZones]);

  // Send coordinates update to the Leaflet webview without reloading the webview
  const updateMapMarker = useCallback((lat, lng, acc, recenter = false) => {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return;
    const nAcc = Math.round(Number(acc) || 20);
    const script = `
      if (typeof window.updateUserLocation === 'function') {
        window.updateUserLocation(${nLat}, ${nLng}, ${nAcc}, '${userInitial}', ${recenter ? 'true' : 'false'});
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, [userInitial]);

  // Update map pin when coords change and map is ready
  useEffect(() => {
    if (mapReady && coords) {
      const shouldRecenter = !hasCenteredUser.current;
      updateMapMarker(coords.latitude, coords.longitude, coords.accuracy, shouldRecenter);
      if (shouldRecenter) {
        hasCenteredUser.current = true;
      }
    }
  }, [coords, mapReady, updateMapMarker]);

  // Toggle risk zones polygons visibility in Leaflet
  const handleToggleRiskZones = () => {
    const nextState = !showRiskZones;
    setShowRiskZones(nextState);
    webViewRef.current?.injectJavaScript(`
      if (typeof window.toggleRiskZones === 'function') {
        window.toggleRiskZones(${nextState ? 'true' : 'false'});
      }
      true;
    `);
  };

  // Fit all zones in Leaflet view
  const handleFitAllZones = () => {
    webViewRef.current?.injectJavaScript(`
      if (typeof window.fitAllZones === 'function') {
        window.fitAllZones();
      }
      true;
    `);
  };

  // Zoom directly to a specific zone on the map
  const handleZoomToZone = (zone) => {
    const center = getZoneCenter(zone?.geometry);
    if (center) {
      setActiveViewMode('map');
      const script = `
        if (typeof window.zoomToCoords === 'function') {
          window.zoomToCoords(${center.latitude}, ${center.longitude}, 16);
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(script);
      Alert.alert('Focused on Zone', `Map centered on ${zone.name} (${String(zone.zone_type || 'safe').toUpperCase()}).`);
    } else {
      Alert.alert('Zone Coordinates', 'Geofence coordinates are not available for this perimeter.');
    }
  };

  // Fetch past breadcrumb locations for History Trail
  const handleToggleHistoryTrail = async () => {
    if (showHistory) {
      setShowHistory(false);
      webViewRef.current?.injectJavaScript(`
        if (typeof window.clearHistoryTrail === 'function') {
          window.clearHistoryTrail();
        }
        true;
      `);
      return;
    }

    try {
      const res = await apiClient.get(API_ENDPOINTS.LOCATIONS, { params: { limit: 50 } });
      const pts = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.locations)
          ? res.data.locations
          : [];
      const cleanPts = pts
        .map((p) => ({
          lat: Number(p.latitude),
          lng: Number(p.longitude),
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

      setShowHistory(true);

      const jsonStr = JSON.stringify(cleanPts).replace(/</g, '\\u003c');
      webViewRef.current?.injectJavaScript(`
        if (typeof window.renderHistoryTrail === 'function') {
          window.renderHistoryTrail(${jsonStr});
        }
        true;
      `);
      Alert.alert('History Trail Active', `Displaying ${cleanPts.length} past location checkpoints on map.`);
    } catch (e) {
      Alert.alert('History Trail', 'No past location checkpoints recorded yet.');
    }
  };

  // Handle messages dispatched from the Leaflet WebView
  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'WEBVIEW_ERROR') {
        console.error('🔴 [WebView Error]:', data.message);
      } else if (data.type === 'WEBVIEW_LOG') {
        console.log('🟢 [WebView Log]:', data.message);
      } else if (data.type === 'LEAFLET_READY') {
        setMapReady(true);
        if (coords) {
          updateMapMarker(coords.latitude, coords.longitude, coords.accuracy, !hasCenteredUser.current);
          hasCenteredUser.current = true;
        }
        if (safeZones.length > 0) {
          sendZonesToMap(safeZones);
        }
      } else if (data.type === 'MAP_CLICK') {
        const newCoords = {
          latitude: data.lat,
          longitude: data.lng,
          accuracy: 5,
        };
        setCoords(newCoords);
        updateMapMarker(data.lat, data.lng, 5, false);

        // Raycast check immediately
        const entered = checkPointInZones(newCoords, safeZones);
        if (entered) {
          setActiveZoneAlert(entered);
          Vibration.vibrate([0, 300, 200, 300]);
        } else {
          setActiveZoneAlert(null);
        }

        // Post location to backend
        locationService.syncLocationToServer(newCoords).catch(() => { });
      } else if (data.type === 'REPORT_HAZARD') {
        handleLogHazardInZone(data.zoneName, data.zoneType);

      } else if (data.type === 'SAFE_HAVEN_NAVIGATE') {
        const foundHaven = safeHavens.find((h) => h.id === data.id);
        navigation.navigate('InAppNavigation', {
          facility: foundHaven || {
            id: data.id,
            name: data.name,
            latitude: Number(data.lat),
            longitude: Number(data.lng),
            type: data.facilityType || 'police',
            phone: data.phone,
            address: data.address,
          },
          originCoords: coords,
        });
      } else if (data.type === 'SAFE_HAVEN_CALL') {
        safeHavenService.callFacility(data.phone);
      } else if (data.type === 'SAFE_HAVEN_CLICK') {
        setSelectedHavenId(data.id);
        setShowHavensDrawer(true);
      }
    } catch (_) { }
  };

  // Log Hazard / Risk Alert (Web Parity)
  const handleLogRiskAlert = async () => {
    setLoggingAlert(true);
    try {
      let loc = coords;
      if (!loc) {
        loc = await locationService.getCurrentLocation();
        if (loc) setCoords(loc);
      }
      if (!loc) {
        loc = { latitude: 28.6129, longitude: 77.2295, accuracy: 25 };
      }

      const entered = checkPointInZones(loc, safeZones);
      const zoneMessage = entered
        ? `Tourist reported hazard inside ${entered.name} (${entered.zone_type} zone). Immediate response requested.`
        : `Tourist safety concern / hazard logged at coordinates (${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}).`;

      await apiClient.post(API_ENDPOINTS.ALERTS, {
        type: 'geofence',
        severity: entered?.zone_type === 'restricted' ? 'high' : 'medium',
        message: zoneMessage,
        location: loc,
        status: 'active',
      });

      Vibration.vibrate([0, 400, 200, 400]);
      Alert.alert(
        'Risk Alert Dispatched',
        'Your safety concern and live coordinates have been transmitted to tourism operators and responders.'
      );
    } catch (err) {
      Alert.alert('Alert Error', err.message || 'Could not log hazard alert.');
    } finally {
      setLoggingAlert(false);
    }
  };

  const handleLogHazardInZone = (zoneName, zoneType) => {
    Alert.alert(
      `Report Hazard in ${zoneName}`,
      `Would you like to broadcast a safety hazard report for ${zoneName} (${zoneType} zone)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.post(API_ENDPOINTS.ALERTS, {
                type: 'geofence',
                severity: String(zoneType).toLowerCase() === 'restricted' ? 'high' : 'medium',
                message: `Tourist hazard report in ${zoneName} (${zoneType} zone).`,
                location: coords,
                status: 'active',
              });
              Alert.alert('Report Logged', `Hazard in ${zoneName} has been flagged for inspection.`);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to submit report.');
            }
          },
        },
      ]
    );
  };

  // Send risk and safe zones to the interactive Leaflet map
  const sendZonesToMap = useCallback((zoneList) => {
    if (!Array.isArray(zoneList)) return;
    const formatted = zoneList.map((z) => {
      const zType = String(z?.zone_type || 'safe').toLowerCase();
      const color =
        zType === 'restricted'
          ? '#ef4444'
          : zType === 'risky' || zType === 'warning'
            ? '#f59e0b'
            : '#10b981';
      return {
        id: z?._id || z?.id,
        name: z?.name || 'Protected Zone',
        type: zType.toUpperCase(),
        description: z?.description || 'Government monitored perimeter',
        color,
        rings: extractLeafletRings(z?.geometry),
      };
    });
    const jsonStr = JSON.stringify(formatted).replace(/</g, '\u003c');
    webViewRef.current?.injectJavaScript(`
      if (typeof window.setZones === 'function') {
        window.setZones(${jsonStr});
      }
      true;
    `);
  }, []);

  // Update map risk zones whenever zones list changes or map signals ready
  useEffect(() => {
    if (mapReady && safeZones.length > 0) {
      sendZonesToMap(safeZones);
    }
  }, [safeZones, mapReady, sendZonesToMap]);

  const handleSyncLocation = async () => {
    setSyncing(true);
    try {
      const loc = await locationService.getCurrentLocation();
      if (loc) {
        setCoords(loc);
        updateMapMarker(loc.latitude, loc.longitude, loc.accuracy, true);
      }

      if (!loc) {
        Alert.alert('Location Unavailable', 'Please enable GPS permissions on your device.');
        return;
      }

      const res = await locationService.syncLocationToServer(loc);
      const warnings = res?.alerts || res?.warnings || [];

      if (warnings.length > 0) {
        const firstWarn = warnings[0];
        const zoneName = firstWarn.zone_name || 'Restricted Area';
        const zoneType = String(firstWarn.zone_type || 'warning').toUpperCase();
        Alert.alert('GEOFENCE BREACH', `Warning: You have stepped into ${zoneName} (${zoneType})! Exit immediately.`);
      } else {
        Alert.alert('Perimeter Verified', 'Coordinates synced successfully. You are currently in a verified safe sector.');
      }
    } catch (e) {
      Alert.alert('Sync Failed', e.message || 'Could not sync GPS coordinates.');
    } finally {
      setSyncing(false);
    }
  };

  const handleRecenter = async () => {
    if (coords && Number.isFinite(Number(coords.latitude)) && Number.isFinite(Number(coords.longitude))) {
      updateMapMarker(coords.latitude, coords.longitude, coords.accuracy, true);
    }
    setSyncing(true);
    try {
      const freshLoc = await locationService.getCurrentLocation(true);
      if (freshLoc && Number.isFinite(Number(freshLoc.latitude)) && Number.isFinite(Number(freshLoc.longitude))) {
        setCoords(freshLoc);
        updateMapMarker(freshLoc.latitude, freshLoc.longitude, freshLoc.accuracy, true);
        locationService.syncLocationToServer(freshLoc).catch(() => { });
      }
    } catch (e) {
      console.warn('Recenter GPS error:', e.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleLiveTracking = () => {
    if (isLiveTracking) {
      locationService.stopTracking();
      setIsLiveTracking(false);
      Alert.alert('Live GPS Paused', 'Continuous telemetry broadcast has been stopped.');
    } else {
      locationService.startTracking((newCoords) => {
        if (newCoords) {
          setCoords(newCoords);
          updateMapMarker(newCoords.latitude, newCoords.longitude, newCoords.accuracy, false);
        }
      });
      setIsLiveTracking(true);
      Alert.alert('Live GPS Active', 'Streaming high-frequency GPS telemetry to tourism responders.');
    }
  };

  const getZoneBadgeColor = (type) => {
    const t = String(type || '').toLowerCase();
    if (t === 'restricted' || t === 'danger') return Colors.danger;
    if (t === 'warning' || t === 'caution' || t === 'risky') return Colors.warning;
    return Colors.success;
  };

  // Compute nearest zone distance
  let closestZone = null;
  let minDistance = Infinity;

  if (coords && Number.isFinite(Number(coords.latitude)) && Number.isFinite(Number(coords.longitude))) {
    const userLat = Number(coords.latitude);
    const userLng = Number(coords.longitude);
    for (const z of safeZones) {
      if (z.is_active === false) continue;
      const center = getZoneCenter(z.geometry);
      if (center) {
        const d = getDistanceKm(userLat, userLng, center.latitude, center.longitude);
        if (d !== null && d < minDistance) {
          minDistance = d;
          closestZone = { ...z, distanceKm: d };
        }
      }
    }
  }

  // 🏥 1-Tap "Safe Havens" Locator Handlers
  const handleFindSafeHavens = async () => {
    setIsFindingHavens(true);
    try {
      Vibration.vibrate([0, 40, 40, 40]);
      let currentCoords = coords;
      if (!currentCoords?.latitude || !currentCoords?.longitude) {
        currentCoords = await locationService.getCurrentLocation();
        if (currentCoords) setCoords(currentCoords);
      }

      const havens = await safeHavenService.getNearbySafeHavens(currentCoords, 10, 'all');
      setSafeHavens(havens);
      setShowHavensDrawer(true);

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (typeof window.setSafeHavens === 'function') {
            window.setSafeHavens(${JSON.stringify(havens)});
          }
          true;
        `);
      }

      if (havens.length > 0) {
        Alert.alert(
          '🏥 Safe Havens Located',
          `Found ${havens.length} emergency facilities nearby:\n• 🚓 ${havens.filter(h => h.type === 'police').length} Police Station(s)\n• 🏥 ${havens.filter(h => h.type === 'hospital').length} Hospital(s)\n• 💊 ${havens.filter(h => h.type === 'pharmacy').length} 24/7 Pharmacy(s)\n\nPinned on radar and map with 1-tap Google Navigation.`
        );
      } else {
        Alert.alert('No Facilities Nearby', 'No safe havens were detected within 5km radius.');
      }
    } catch (err) {
      console.warn('Error finding safe havens:', err);
      Alert.alert('Safe Havens', 'Unable to query safe havens. Please ensure GPS is enabled.');
    } finally {
      setIsFindingHavens(false);
    }
  };
  const handleClearSafeHavens = () => {
    setSafeHavens([]);
    setShowHavensDrawer(false);
    setSelectedHavenId(null);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.clearSafeHavens === 'function') {
          window.clearSafeHavens();
        }
        true;
      `);
    }
  };

  const handleFocusHaven = (haven) => {
    setSelectedHavenId(haven.id);
    if (activeViewMode !== 'map') {
      setActiveViewMode('map');
    }
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.focusSafeHaven === 'function') {
          window.focusSafeHaven('${haven.id}', ${haven.latitude}, ${haven.longitude});
        }
        true;
      `);
    }
  };

  const filteredHavens = useMemo(() => {
    if (selectedCategory === 'all') return safeHavens;
    return safeHavens.filter((h) => h.type === selectedCategory);
  }, [safeHavens, selectedCategory]);

  const havenCounts = useMemo(() => {
    return {
      all: safeHavens.length,
      police: safeHavens.filter((h) => h.type === 'police').length,
      hospital: safeHavens.filter((h) => h.type === 'hospital').length,
      pharmacy: safeHavens.filter((h) => h.type === 'pharmacy').length,
    };
  }, [safeHavens]);

  const spin = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header Row */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Safety Map & Radar</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.aiQuickBtn}
            onPress={() => navigation.navigate('AiAssistant')}
          >
            <Ionicons name="sparkles" size={14} color="#38bdf8" />
            <Text style={styles.aiQuickBtnText}>Ask AI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sosQuickBtn}
            onPress={() => emergencyService.callEmergencyHelpline('112')}
          >
            <Ionicons name="call" size={14} color={Colors.white} />
            <Text style={styles.sosQuickBtnText}>112</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.viewModeSwitcher}>
        <TouchableOpacity
          style={[styles.viewModeTab, activeViewMode === 'map' && styles.viewModeTabActive]}
          onPress={() => setActiveViewMode('map')}
        >
          <Ionicons
            name="map"
            size={16}
            color={activeViewMode === 'map' ? Colors.white : Colors.textSecondary}
          />
          <Text style={[styles.viewModeText, activeViewMode === 'map' && styles.viewModeTextActive]}>
            Interactive Leaflet Map
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewModeTab, activeViewMode === 'radar' && styles.viewModeTabActive]}
          onPress={() => setActiveViewMode('radar')}
        >
          <Ionicons
            name="radio"
            size={16}
            color={activeViewMode === 'radar' ? Colors.white : Colors.textSecondary}
          />
          <Text style={[styles.viewModeText, activeViewMode === 'radar' && styles.viewModeTextActive]}>
            Radar Scope HUD
          </Text>
        </TouchableOpacity>
      </View>

      {/* Restricted Area Warning Banner (Web Parity) */}
      {activeZoneAlert ? (
        <View style={styles.zoneBreachBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.zoneBreachTitle}>🚨 RESTRICTED AREA WARNING</Text>
            <Text style={styles.zoneBreachText}>
              You have entered <Text style={{ fontWeight: '800' }}>"{activeZoneAlert.name}"</Text> ({String(activeZoneAlert.zone_type || 'RESTRICTED').toUpperCase()})!
            </Text>
          </View>
          <TouchableOpacity
            style={styles.callHelpBtn}
            onPress={() => emergencyService.callEmergencyHelpline('112')}
          >
            <Text style={styles.callHelpBtnText}>Call Help</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* VIEW 1: Interactive Leaflet Map */}
      {activeViewMode === 'map' && (
        <View style={styles.mapContainer}>
          {/* Map Controls Bar (Web Parity) */}
          <View style={styles.mapControlsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlsScroll}>
              {/* 🏥 1-Tap Safe Havens Locator Chip */}
              <TouchableOpacity
                style={[styles.controlChip, safeHavens.length > 0 && styles.controlChipActiveEmergency]}
                onPress={handleFindSafeHavens}
                disabled={isFindingHavens}
              >
                {isFindingHavens ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons
                    name="medical"
                    size={13}
                    color={safeHavens.length > 0 ? Colors.white : '#ef4444'}
                  />
                )}
                <Text
                  style={[
                    styles.controlChipText,
                    safeHavens.length > 0
                      ? styles.controlChipTextActive
                      : { color: '#f87171', fontWeight: '800' },
                  ]}
                >
                  {safeHavens.length > 0 ? `Havens (${safeHavens.length})` : '🏥 Find Help'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlChip, showRiskZones && styles.controlChipActive]}
                onPress={handleToggleRiskZones}
              >
                <Ionicons
                  name={showRiskZones ? 'shield-checkmark' : 'shield-outline'}
                  size={13}
                  color={showRiskZones ? Colors.white : Colors.textSecondary}
                />
                <Text style={[styles.controlChipText, showRiskZones && styles.controlChipTextActive]}>
                  Risk Zones ({safeZones.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlChip} onPress={handleFitAllZones}>
                <Ionicons name="scan-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.controlChipText}>Fit All Zones</Text>
              </TouchableOpacity>

              {activeTrip ? (
                <TouchableOpacity
                  style={[styles.controlChip, styles.controlChipActiveTrip]}
                  onPress={() => {
                    Alert.alert(
                      'Active Safe Trip',
                      `Destination: ${activeTrip.destination || 'Destination'}\n\nStatus: In Progress\nSafe route is drawn on the map.\n\nWould you like to complete this trip?`,
                      [
                        { text: 'Keep Navigating', style: 'cancel' },
                        { text: 'Complete Trip', style: 'destructive', onPress: handleCompleteActiveTrip },
                      ]
                    );
                  }}
                >
                  <Ionicons name="navigate" size={13} color="#fff" />
                  <Text style={[styles.controlChipText, styles.controlChipTextActive]}>
                    📍 Active Trip
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.controlChip, { borderColor: '#38bdf8' }]}
                  onPress={() => setShowTripRegisterModal(true)}
                >
                  <Ionicons name="map-outline" size={13} color="#38bdf8" />
                  <Text style={[styles.controlChipText, { color: '#38bdf8' }]}>
                    🗺️ Register Trip
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.controlChip, showHistory && styles.controlChipActive]}
                onPress={handleToggleHistoryTrail}
              >
                <Ionicons
                  name="trail-sign"
                  size={13}
                  color={showHistory ? Colors.white : Colors.textSecondary}
                />
                <Text style={[styles.controlChipText, showHistory && styles.controlChipTextActive]}>
                  History Trail
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlChip} onPress={loadMapData}>
                <Ionicons name="refresh" size={13} color={Colors.textSecondary} />
                <Text style={styles.controlChipText}>Sync</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlChip, { borderColor: '#38bdf8' }]}
                onPress={() => navigation.navigate('EmergencyPhrasebook')}
              >
                <Ionicons name="volume-high" size={13} color="#38bdf8" />
                <Text style={[styles.controlChipText, { color: '#38bdf8' }]}>
                  🗣️ Voice Board
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlChip, isLiveTracking && styles.controlChipActiveDanger]}
                onPress={toggleLiveTracking}
              >
                <Ionicons
                  name={isLiveTracking ? 'stop-circle' : 'play-circle'}
                  size={13}
                  color={isLiveTracking ? Colors.white : Colors.primary}
                />
                <Text
                  style={[
                    styles.controlChipText,
                    isLiveTracking ? styles.controlChipTextActive : { color: Colors.primary },
                  ]}
                >
                  {isLiveTracking ? 'Stop Live GPS' : 'Start Live GPS'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Embedded Web Leaflet Map */}
          <View style={styles.webViewWrap}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: STATIC_LEAFLET_HTML, baseUrl: 'https://unpkg.com' }}
              style={styles.webView}
              containerStyle={{ width: '100%', height: 380 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              nestedScrollEnabled={true}
              androidHardwareAccelerationDisabled={false}
              mixedContentMode="always"
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              geolocationEnabled={true}
              onMessage={handleWebViewMessage}
              onLoadEnd={() => {
                setMapReady(true);
                webViewRef.current?.injectJavaScript(`
                  if (typeof map !== 'undefined' && map) {
                    map.invalidateSize();
                  }
                  true;
                `);
              }}
              onError={(e) => console.warn('🔴 Leaflet WebView Error:', e.nativeEvent)}
              onHttpError={(e) => console.warn('🔴 Leaflet WebView HTTP Error:', e.nativeEvent)}
            />

            {/* Loading Placeholder until Leaflet signals ready */}
            {!mapReady && (
              <View style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.mapLoadingText}>Loading Leaflet Safety Map...</Text>
              </View>
            )}

            {/* Click Map Hint Badge */}
            <View style={styles.mapHintBadge}>
              <Text style={styles.mapHintText}>👉 Tap anywhere on map to pin custom location</Text>
            </View>

            {/* Center GPS Floating FAB */}
            <TouchableOpacity
              style={styles.floatingCenterBtn}
              onPress={handleRecenter}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="locate" size={20} color={Colors.white} />
              )}
            </TouchableOpacity>
          </View>

          {/* Active Trip Safe Navigation Card */}
          {activeTrip && (
            <View style={styles.activeTripOverlayCard}>
              <View style={styles.activeTripHeaderRow}>
                <View style={styles.activeTripIconWrap}>
                  <Ionicons name="navigate-circle" size={26} color="#38bdf8" />
                </View>
                <View style={styles.activeTripTextWrap}>
                  <Text style={styles.activeTripDestTitle} numberOfLines={1}>
                    To: {activeTrip.destination || 'Destination'}
                  </Text>
                  {activeTrip.startPoint && !activeTrip.startPoint.toLowerCase().includes('current') && (
                    <Text style={[styles.activeTripMetaText, { color: '#c084fc', fontWeight: '700' }]} numberOfLines={1}>
                      🏁 From: {activeTrip.startPoint}
                    </Text>
                  )}
                  <Text style={styles.activeTripMetaText}>
                    {loadingTripRoute
                      ? 'Calculating shortest safe route...'
                      : tripRouteData
                        ? `Distance: ${(tripRouteData.distanceMeters / 1000).toFixed(1)} km • ~${Math.round(tripRouteData.durationSeconds / 60)} min`
                        : 'Safe route loaded on map'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.activeTripCompleteBtn}
                  onPress={handleCompleteActiveTrip}
                >
                  <Ionicons name="checkmark-done" size={15} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.activeTripCompleteBtnText}>Complete</Text>
                </TouchableOpacity>
              </View>

              {tripRouteData?.hazardAvoidanceActive && (
                <View style={styles.activeTripDetourBanner}>
                  <Ionicons name="shield-checkmark" size={14} color="#f59e0b" />
                  <Text style={styles.activeTripDetourText}>
                    Safe Detour Active: Smallest distance path bypassing risk zone ({tripRouteData.avoidedHazards?.join(', ') || 'Hazard Area'}).
                  </Text>
                </View>
              )}
              {tripRouteData && !tripRouteData.hazardAvoidanceActive && (
                <View style={styles.activeTripSafeBanner}>
                  <Ionicons name="shield-checkmark" size={14} color="#10b981" />
                  <Text style={styles.activeTripSafeText}>
                    Safe Direct Corridor: 0 risk zones on route.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Map Legend */}
          <View style={styles.mapLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.legendText}>Safe</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Risky</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Restricted</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#0284c7' }]} />
              <Text style={styles.legendText}>👤 {userInitial} (You)</Text>
            </View>
          </View>

          {/* GPS Accuracy / Precision Indicator Bar */}
          {coords && Number.isFinite(Number(coords.accuracy)) && (
            <View style={styles.accuracyBanner}>
              <Ionicons
                name={Number(coords.accuracy) <= 25 ? 'checkmark-circle' : 'information-circle'}
                size={14}
                color={Number(coords.accuracy) <= 25 ? Colors.success : Colors.warning}
              />
              <Text style={styles.accuracyBannerText}>
                {Number(coords.accuracy) <= 25
                  ? `Pinpoint Satellite GPS active (±${Math.round(coords.accuracy)}m)`
                  : `Approximate GPS (±${Math.round(coords.accuracy)}m). Tap FAB to re-center.`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* VIEW 2: Visual Animated Radar Scanner HUD */}
      {activeViewMode === 'radar' && (
        <View style={styles.radarCard}>
          <View style={styles.radarHeader}>
            <View style={styles.radarHeaderLeft}>
              <Ionicons name="radio" size={18} color={Colors.primary} />
              <Text style={styles.radarTitle}>Live Radar Scope</Text>
            </View>
            <TouchableOpacity
              style={[styles.radarToggleBtn, isLiveTracking && styles.radarToggleBtnActive]}
              onPress={toggleLiveTracking}
            >
              <View style={[styles.radarToggleDot, isLiveTracking && styles.radarToggleDotActive]} />
              <Text style={[styles.radarToggleText, isLiveTracking && styles.radarToggleTextActive]}>
                {isLiveTracking ? 'LIVE STREAMING' : 'START RADAR'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Circular Radar Scope Display */}
          <View style={styles.radarScopeWrapper}>
            <View style={[styles.radarScope, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
              {/* Concentric distance rings */}
              <View style={[styles.radarRing, { width: RADAR_SIZE * 0.85, height: RADAR_SIZE * 0.85 }]} />
              <View style={[styles.radarRing, { width: RADAR_SIZE * 0.6, height: RADAR_SIZE * 0.6 }]} />
              <View style={[styles.radarRing, { width: RADAR_SIZE * 0.35, height: RADAR_SIZE * 0.35 }]} />

              {/* Crosshairs */}
              <View style={[styles.crosshairH, { width: RADAR_SIZE }]} />
              <View style={[styles.crosshairV, { height: RADAR_SIZE }]} />

              {/* Animated Pulse Waves */}
              <Animated.View
                style={[
                  styles.pulseCircle,
                  {
                    width: RADAR_SIZE,
                    height: RADAR_SIZE,
                    opacity: pulseAnim1.interpolate({
                      inputRange: [0, 0.7, 1],
                      outputRange: [0.6, 0.2, 0],
                    }),
                    transform: [
                      {
                        scale: pulseAnim1.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseCircle,
                  {
                    width: RADAR_SIZE,
                    height: RADAR_SIZE,
                    opacity: pulseAnim2.interpolate({
                      inputRange: [0, 0.7, 1],
                      outputRange: [0.6, 0.2, 0],
                    }),
                    transform: [
                      {
                        scale: pulseAnim2.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />

              {/* Rotating Sweep Needle */}
              <Animated.View
                style={[
                  styles.radarSweepContainer,
                  {
                    width: RADAR_SIZE,
                    height: RADAR_SIZE,
                    transform: [{ rotate: spin }],
                  },
                ]}
              >
                <View style={[styles.sweepLine, { height: RADAR_SIZE / 2 }]} />
              </Animated.View>


              {/* Safe Haven Radar Blips */}
              {safeHavens.map((haven) => {
                if (!coords) return null;
                const dLat = (haven.latitude - coords.latitude) * 111;
                const dLng = (haven.longitude - coords.longitude) * 111 * Math.cos((coords.latitude * Math.PI) / 180);
                const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
                const maxRadiusKm = 10;
                if (distKm > maxRadiusKm) return null;
                const factor = (RADAR_SIZE / 2 - 18) / maxRadiusKm;
                const x = RADAR_SIZE / 2 + dLng * factor;
                const y = RADAR_SIZE / 2 - dLat * factor;
                const dotColor = haven.type === 'police' ? '#3b82f6' : haven.type === 'hospital' ? '#ef4444' : '#10b981';
                return (
                  <TouchableOpacity
                    key={haven.id}
                    style={[styles.radarHavenBlip, { left: x - 10, top: y - 10, borderColor: dotColor }]}
                    onPress={() => handleFocusHaven(haven)}
                  >
                    <Text style={styles.radarHavenEmoji}>
                      {haven.type === 'police' ? '👮' : haven.type === 'hospital' ? '🏥' : '💊'}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Center User Pin */}
              <View style={styles.centerBlipContainer}>
                <View style={styles.centerBlipOuter} />
                <View style={styles.centerBlipInner} />
              </View>

              {/* Range labels */}
              <Text style={[styles.rangeLabel, { top: 12 }]}>25 km</Text>
              <Text style={[styles.rangeLabel, { top: RADAR_SIZE * 0.2 }]}>10 km</Text>
              <Text style={[styles.rangeLabel, { top: RADAR_SIZE * 0.32 }]}>2 km</Text>
            </View>
          </View>

          {/* Closest Risk Notice if detected */}

          {/* 🏥 1-Tap "Safe Havens" Locator Hero Card */}
          <View style={styles.safeHavensHeroCard}>
            <View style={styles.safeHavensHeroHeader}>
              <View style={styles.safeHavensTitleWrap}>
                <View style={styles.safeHavensIconBadge}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.safeHavensTitle}>1-Tap "Safe Havens" Locator</Text>
                  <Text style={styles.safeHavensSubtitle}>
                    Nearest Police, Govt Hospitals & 24/7 Meds
                  </Text>
                </View>
              </View>
              {safeHavens.length > 0 && (
                <TouchableOpacity
                  style={styles.safeHavensClearBtn}
                  onPress={handleClearSafeHavens}
                >
                  <Ionicons name="close-circle" size={14} color={Colors.textSecondary} />
                  <Text style={styles.safeHavensClearText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Instant "Find Help Nearby" Action Button */}
            <TouchableOpacity
              style={[
                styles.findHelpNearbyBtn,
                isFindingHavens && styles.findHelpNearbyBtnLoading,
              ]}
              onPress={handleFindSafeHavens}
              disabled={isFindingHavens}
              activeOpacity={0.85}
            >
              {isFindingHavens ? (
                <View style={styles.findHelpRow}>
                  <ActivityIndicator size="small" color={Colors.white} />
                  <Text style={styles.findHelpBtnText}>Locating Nearest Responders...</Text>
                </View>
              ) : (
                <View style={styles.findHelpRow}>
                  <Ionicons name="navigate" size={18} color={Colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.findHelpBtnText}>
                    {safeHavens.length > 0
                      ? `Find Help Nearby (${safeHavens.length} Available)`
                      : 'Find Help Nearby (Instant Rescue)'}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={Colors.white} style={{ marginLeft: 8 }} />
                </View>
              )}
            </TouchableOpacity>

            {/* Sub-pills: 24/7 Police, Trauma Centers, 24/7 Pharmacies */}
            <View style={styles.havenTypesPillRow}>
              <View style={styles.havenTypePill}>
                <Text style={styles.havenTypePillText}>🚓 24/7 Police</Text>
              </View>
              <View style={styles.havenTypePill}>
                <Text style={styles.havenTypePillText}>🏥 Govt Hospitals</Text>
              </View>
              <View style={styles.havenTypePill}>
                <Text style={styles.havenTypePillText}>💊 24/7 Meds</Text>
              </View>
            </View>
          </View>

          {closestZone ? (
            <View style={styles.proximityBanner}>
              <Ionicons name="information-circle" size={16} color={Colors.warning} />
              <Text style={styles.proximityText}>
                Nearest boundary: <Text style={{ fontWeight: '800' }}>{closestZone.name}</Text> (~
                {closestZone.distanceKm < 1
                  ? `${Math.round(closestZone.distanceKm * 1000)} m`
                  : `${closestZone.distanceKm.toFixed(1)} km`}
                )
              </Text>
            </View>
          ) : (
            <View style={styles.proximityBanner}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
              <Text style={styles.proximityText}>
                All registered geofence perimeters are actively monitored.
              </Text>
            </View>
          )}
        </View>
      )}


      {/* 🏥 Safe Havens Facility List Deck (When Active) */}
      {safeHavens.length > 0 && (
        <View style={styles.safeHavensDeckCard}>
          <View style={styles.deckHeaderRow}>
            <View style={styles.deckHeaderLeft}>
              <Ionicons name="medical" size={18} color="#ef4444" />
              <Text style={styles.deckTitle}>Nearest Verified Safe Havens</Text>
            </View>
            <TouchableOpacity onPress={handleClearSafeHavens}>
              <Text style={styles.deckClearText}>Hide Havens</Text>
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabsScroll}>
            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'all' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text style={[styles.categoryTabText, selectedCategory === 'all' && styles.categoryTabTextActive]}>
                All ({havenCounts.all})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'police' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('police')}
            >
              <Text style={[styles.categoryTabText, selectedCategory === 'police' && styles.categoryTabTextActive]}>
                🚓 Police ({havenCounts.police})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'hospital' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('hospital')}
            >
              <Text style={[styles.categoryTabText, selectedCategory === 'hospital' && styles.categoryTabTextActive]}>
                🏥 Hospitals ({havenCounts.hospital})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryTab, selectedCategory === 'pharmacy' && styles.categoryTabActive]}
              onPress={() => setSelectedCategory('pharmacy')}
            >
              <Text style={[styles.categoryTabText, selectedCategory === 'pharmacy' && styles.categoryTabTextActive]}>
                💊 Pharmacies ({havenCounts.pharmacy})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Safe Havens Card List */}
          {filteredHavens.map((haven) => {
            const isPolice = haven.type === 'police';
            const isHospital = haven.type === 'hospital';
            const badgeBg = isPolice ? 'rgba(59, 130, 246, 0.18)' : isHospital ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)';
            const badgeColor = isPolice ? '#93c5fd' : isHospital ? '#fca5a5' : '#6ee7b7';
            const isSelected = selectedHavenId === haven.id;

            return (
              <View
                key={haven.id}
                style={[styles.havenItemCard, isSelected && styles.havenItemCardSelected]}
              >
                {/* Haven Header */}
                <View style={styles.havenItemHeader}>
                  <View style={[styles.havenTypeBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.havenTypeBadgeText, { color: badgeColor }]}>
                      {haven.typeName || (isPolice ? '24/7 POLICE' : isHospital ? 'GOVT HOSPITAL' : '24/7 PHARMACY')}
                    </Text>
                  </View>
                  <View style={styles.havenDistBadge}>
                    <Ionicons name="navigate-circle" size={13} color="#38bdf8" />
                    <Text style={styles.havenDistText}>{haven.distanceFormatted || 'Nearby'}</Text>
                  </View>
                </View>

                {/* Facility Name & Address */}
                <Text style={styles.havenNameText}>{haven.name}</Text>
                <Text style={styles.havenAddressText}>{haven.address}</Text>

                {/* Phone & Status Line */}
                <View style={styles.havenPhoneRow}>
                  <Ionicons name="call-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.havenPhoneText}>
                    Emergency Line: <Text style={{ color: Colors.white, fontWeight: '700' }}>{haven.phone || haven.directPhone || '112'}</Text>
                  </Text>
                </View>

                {/* In-App Navigation & 1-Tap Helpline Call */}
                <View style={styles.havenActionRow}>
                  <TouchableOpacity
                    style={styles.havenNavigateBtn}
                    onPress={() => {
                      navigation.navigate('InAppNavigation', {
                        facility: haven,
                        originCoords: coords,
                      });
                    }}
                  >
                    <Ionicons name="navigate" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.havenNavigateBtnText}>Navigate</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.havenCallBtn}
                    onPress={() => safeHavenService.callFacility(haven.phone || haven.directPhone || '112')}
                  >
                    <Ionicons name="call" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.havenCallBtnText}>Call Helpline</Text>
                  </TouchableOpacity>
                </View>

                {/* Map Focus Link */}
                <TouchableOpacity
                  style={styles.havenFocusMapRow}
                  onPress={() => handleFocusHaven(haven)}
                >
                  <Ionicons name="map-outline" size={12} color="#38bdf8" />
                  <Text style={styles.havenFocusMapText}>Show on Interactive Map Pin</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}


      {/* Emergency Dispatch & Hazard Action Card (Web Parity) */}
      <View style={styles.dispatchCard}>
        <View style={styles.dispatchHeader}>
          <Ionicons name="alert-circle" size={18} color={Colors.danger} />
          <Text style={styles.dispatchTitle}>Emergency Dispatch & Hazard Alert</Text>
        </View>
        <Text style={styles.dispatchSubtitle}>
          Encountering safety risks? Report an immediate hazard or call the police control center.
        </Text>
        <View style={styles.dispatchBtnRow}>
          <TouchableOpacity
            style={styles.logAlertBtn}
            onPress={handleLogRiskAlert}
            disabled={loggingAlert}
          >
            {loggingAlert ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="warning" size={16} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.logAlertBtnText}>⚠️ Log Risk Alert</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.call112Btn}
            onPress={() => emergencyService.callEmergencyHelpline('112')}
          >
            <Ionicons name="call" size={16} color={Colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.call112BtnText}>Call 112</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* GPS Coordinates Telemetry HUD */}
      <View style={styles.telemetryCard}>
        <View style={styles.telemetryHeader}>
          <Ionicons name="navigate" size={18} color={Colors.primary} />
          <Text style={styles.telemetryTitle}>Location Info & Telemetry</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>GPS PINNED</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : coords ? (
          <View style={styles.coordsGrid}>
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>LATITUDE</Text>
              <Text style={styles.coordValue}>
                {Number.isFinite(Number(coords.latitude)) ? Number(coords.latitude).toFixed(6) : '--'}° N
              </Text>
            </View>
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>LONGITUDE</Text>
              <Text style={styles.coordValue}>
                {Number.isFinite(Number(coords.longitude)) ? Number(coords.longitude).toFixed(6) : '--'}° E
              </Text>
            </View>
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>ACCURACY</Text>
              <Text style={styles.coordValue}>
                ±{Math.round(Number(coords.accuracy) || 10)} meters
              </Text>
            </View>
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>SPEED</Text>
              <Text style={styles.coordValue}>
                {Number.isFinite(Number(coords.speed)) && Number(coords.speed) > 0
                  ? `${(Number(coords.speed) * 3.6).toFixed(1)} km/h`
                  : '0 km/h'}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noCoords}>GPS signal searching... Please enable device location.</Text>
        )}

        <TouchableOpacity
          style={styles.syncBtn}
          onPress={handleSyncLocation}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={16} color={Colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.syncBtnText}>Sync Location with Safety Console</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Monitored Geofences List with "Zoom" Button & "You are here" tag */}
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="layers-outline" size={18} color={Colors.primary} />
        <Text style={styles.sectionTitle}>
          Safety Boundaries ({safeZones.length})
        </Text>
      </View>

      {safeZones.length === 0 ? (
        <View style={styles.emptyZones}>
          <Text style={styles.emptyText}>No safety boundaries registered yet.</Text>
        </View>
      ) : (
        safeZones.map((zone, idx) => {
          const zType = String(zone?.zone_type || 'safe').toLowerCase();
          const badgeColor = getZoneBadgeColor(zType);
          const center = getZoneCenter(zone?.geometry);
          const isUserInZone = activeZoneAlert && (activeZoneAlert._id === zone._id || activeZoneAlert.id === zone.id);

          let distanceStr = null;
          if (coords && center && Number.isFinite(Number(coords.latitude)) && Number.isFinite(Number(coords.longitude))) {
            const dist = getDistanceKm(Number(coords.latitude), Number(coords.longitude), center.latitude, center.longitude);
            if (dist !== null) {
              distanceStr = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
            }
          }

          return (
            <View
              key={zone?._id || zone?.id || `zone-${idx}`}
              style={[
                styles.zoneCard,
                isUserInZone && { borderColor: Colors.danger, borderWidth: 1.5, backgroundColor: 'rgba(239, 68, 68, 0.08)' },
              ]}
            >
              <View style={styles.zoneHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.zoneName, isUserInZone && { color: Colors.danger }]}>
                    {zone?.name || 'Protected Zone'}
                  </Text>
                  {isUserInZone ? (
                    <Text style={styles.youAreHereText}>📍 You are inside this boundary</Text>
                  ) : null}
                </View>
                <View style={[styles.zoneBadge, { backgroundColor: `${badgeColor}20` }]}>
                  <Text style={[styles.zoneBadgeText, { color: badgeColor }]}>
                    {String(zone?.zone_type || 'SAFE').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.zoneDesc}>
                {zone?.description || 'Monitored safety boundary managed by tourism administration.'}
              </Text>

              <View style={styles.zoneFooterRow}>
                {distanceStr && (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="navigate-outline" size={12} color={Colors.primary} />
                    <Text style={styles.distanceBadgeText}>{distanceStr} away</Text>
                  </View>
                )}
                {center ? (
                  <TouchableOpacity
                    style={styles.zoomZoneBtn}
                    onPress={() => handleZoomToZone(zone)}
                  >
                    <Ionicons name="search" size={12} color={Colors.white} style={{ marginRight: 4 }} />
                    <Text style={styles.zoomZoneBtnText}>Zoom</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })
      )}
      {/* Register Trip Safe Route Modal */}
      <Modal
        visible={showTripRegisterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setDestSuggestions([]);
          setStartSuggestions([]);
          setShowTripRegisterModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Register Safe Trip 🛣️</Text>
                <Text style={styles.modalSubtitle}>
                  Automatic risk-zone avoidance & shortest safe detour across India
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setDestSuggestions([]);
                  setStartSuggestions([]);
                  setShowTripRegisterModal(false);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>DESTINATION (ANYWHERE IN INDIA)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Type any monument, city, station, hotel in India..."
                placeholderTextColor={Colors.textSecondary}
                value={tripDestInput}
                onChangeText={handleDestChangeText}
              />

              {loadingDestSearch && (
                <View style={styles.searchLoadingRow}>
                  <ActivityIndicator size="small" color="#38bdf8" />
                  <Text style={styles.searchingText}>Searching places across India...</Text>
                </View>
              )}

              {destSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {destSuggestions.map((item, idx) => (
                    <TouchableOpacity
                      key={`dest-sug-${idx}`}
                      style={[
                        styles.suggestionItem,
                        idx === destSuggestions.length - 1 && styles.suggestionItemLast,
                      ]}
                      onPress={() => handleSelectDestSuggestion(item)}
                    >
                      <View style={styles.suggestionPinCircle}>
                        <Ionicons name="location-sharp" size={15} color="#38bdf8" />
                      </View>
                      <View style={styles.suggestionTextWrap}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                          {item.displayName || [item.city, item.state, 'India'].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>POPULAR DESTINATIONS</Text>
              <View style={styles.quickChipsWrap}>
                {[
                  'Taj Mahal, Agra',
                  'Gateway of India, Mumbai',
                  'KLS Gogte Institute of Technology',
                  'Tilakwadi Police Station',
                  'Belagavi Fort',
                  'KLE Centenary Hospital',
                  'Belagavi Railway Station',
                  'The Mall Road, Manali',
                ].map((dest) => (
                  <TouchableOpacity
                    key={dest}
                    style={styles.quickChip}
                    onPress={() => handleSelectQuickChip(dest)}
                  >
                    <Ionicons name="location-outline" size={12} color="#38bdf8" />
                    <Text style={styles.quickChipText}>{dest}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>START POINT (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Current Live GPS Location (or type any custom start point)"
                placeholderTextColor={Colors.textSecondary}
                value={tripStartInput}
                onChangeText={handleStartChangeText}
              />

              {loadingStartSearch && (
                <View style={styles.searchLoadingRow}>
                  <ActivityIndicator size="small" color="#c084fc" />
                  <Text style={styles.searchingText}>Searching start locations across India...</Text>
                </View>
              )}

              {startSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {startSuggestions.map((item, idx) => (
                    <TouchableOpacity
                      key={`start-sug-${idx}`}
                      style={[
                        styles.suggestionItem,
                        idx === startSuggestions.length - 1 && styles.suggestionItemLast,
                      ]}
                      onPress={() => handleSelectStartSuggestion(item)}
                    >
                      <View style={[styles.suggestionPinCircle, { backgroundColor: 'rgba(192, 132, 252, 0.15)' }]}>
                        <Ionicons name="navigate-circle" size={16} color="#c084fc" />
                      </View>
                      <View style={styles.suggestionTextWrap}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                          {item.displayName || [item.city, item.state, 'India'].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.registerTripSubmitBtn}
                onPress={handleRegisterTripFromMap}
                disabled={registeringTrip}
              >
                {registeringTrip ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="navigate" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.registerTripSubmitText}>Start Safe Trip Navigation</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={{ height: 35 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  controlChipActiveTrip: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  activeTripOverlayCard: {
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(56, 189, 248, 0.25)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
    padding: 12,
  },
  activeTripHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeTripIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTripTextWrap: {
    flex: 1,
  },
  activeTripDestTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 18,
  },
  activeTripMetaText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  activeTripCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  activeTripCompleteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  activeTripDetourBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    gap: 6,
  },
  activeTripDetourText: {
    flex: 1,
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
    lineHeight: 15,
  },
  activeTripSafeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    gap: 6,
  },
  activeTripSafeText: {
    flex: 1,
    fontSize: 11,
    color: '#34d399',
    fontWeight: '700',
    lineHeight: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    height: '92%',
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  suggestionsContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginTop: 6,
    marginBottom: 10,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionPinCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
  },
  searchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  searchingText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickChipText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '600',
  },
  registerTripSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 18,
    marginBottom: 10,
  },
  registerTripSubmitText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  havenVoiceBoardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  havenVoiceBoardBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    flex: 1,
  },


  controlChipActiveEmergency: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
  },
  safeHavensHeroCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  safeHavensHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  safeHavensTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  safeHavensIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  safeHavensTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  safeHavensSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  safeHavensClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  safeHavensClearText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  findHelpNearbyBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f87171',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  findHelpNearbyBtnLoading: {
    backgroundColor: '#991b1b',
  },
  findHelpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  findHelpBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  havenTypesPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  havenTypePill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: 'center',
  },
  havenTypePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  radarHavenBlip: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  radarHavenEmoji: {
    fontSize: 10,
  },
  safeHavensDeckCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  deckHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  deckHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deckTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  deckClearText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  categoryTabsScroll: {
    gap: 8,
    paddingBottom: 10,
  },
  categoryTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  categoryTabTextActive: {
    color: Colors.white,
  },
  havenItemCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  havenItemCardSelected: {
    borderColor: '#38bdf8',
    borderWidth: 1.5,
  },
  havenItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  havenTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  havenTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  havenDistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  havenDistText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
  },
  havenNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 18,
    marginBottom: 4,
  },
  havenAddressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  havenPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  havenPhoneText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  havenActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  havenCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
  },
  havenCallBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  havenNavigateBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
  },
  havenNavigateBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  havenFocusMapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
  },
  havenFocusMapText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '600',
  },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 36 : 14,
    paddingBottom: 36,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  aiQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
  },
  aiQuickBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  sosQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  sosQuickBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  viewModeTabActive: {
    backgroundColor: Colors.primary,
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  viewModeTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  zoneBreachBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#f87171',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  zoneBreachTitle: {
    color: '#991b1b',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 2,
  },
  zoneBreachText: {
    color: '#b91c1c',
    fontSize: 12,
  },
  callHelpBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  callHelpBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
  mapContainer: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  mapControlsBar: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  controlsScroll: {
    paddingHorizontal: 10,
    gap: 8,
  },
  controlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  controlChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  controlChipActiveDanger: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  controlChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  controlChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  webViewWrap: {
    width: '100%',
    height: 380,
    backgroundColor: '#0f172a',
    position: 'relative',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: 380,
    backgroundColor: '#0f172a',
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 12,
  },
  mapLoadingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  mapHintBadge: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  mapHintText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  floatingCenterBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  mapLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  accuracyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(2, 132, 199, 0.15)',
    gap: 8,
  },
  accuracyBannerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  radarCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  radarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  radarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  radarToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radarToggleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: Colors.success,
  },
  radarToggleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  radarToggleDotActive: {
    backgroundColor: Colors.success,
  },
  radarToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  radarToggleTextActive: {
    color: Colors.success,
  },
  radarScopeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  radarScope: {
    borderRadius: 200,
    backgroundColor: '#0a0f1d',
    borderWidth: 2,
    borderColor: 'rgba(2, 132, 199, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 200,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  crosshairH: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
  },
  pulseCircle: {
    position: 'absolute',
    borderRadius: 200,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  radarSweepContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sweepLine: {
    width: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  centerBlipContainer: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  centerBlipOuter: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(2, 132, 199, 0.4)',
  },
  centerBlipInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  rangeLabel: {
    position: 'absolute',
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
  },
  proximityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  proximityText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  dispatchCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  dispatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dispatchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  dispatchSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  dispatchBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  logAlertBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 10,
  },
  logAlertBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  call112Btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
  },
  call112BtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  telemetryCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  telemetryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginLeft: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  coordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  coordBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    borderRadius: 8,
  },
  coordLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 2,
  },
  coordValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  noCoords: {
    color: Colors.textMuted,
    fontSize: 12,
    marginVertical: 10,
    fontStyle: 'italic',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 11,
    borderRadius: 10,
  },
  syncBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  emptyZones: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  zoneCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  youAreHereText: {
    fontSize: 11,
    color: Colors.danger,
    fontWeight: '700',
    marginTop: 2,
  },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  zoneBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  zoneDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  zoneFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceBadgeText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  zoomZoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  zoomZoneBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
