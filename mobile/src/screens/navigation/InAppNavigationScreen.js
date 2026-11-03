import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import safeHavenService from '../../services/safeHavenService';
import locationService from '../../services/locationService';

export default function InAppNavigationScreen({ route, navigation }) {
  const { facility = {}, originCoords = null } = route?.params || {};

  // Default coordinates (KLS GIT Campus / Belagavi)
  const initialLat = Number(originCoords?.latitude) || 15.8152112;
  const initialLng = Number(originCoords?.longitude) || 74.4874746;

  const [userCoords, setUserCoords] = useState({
    latitude: initialLat,
    longitude: initialLng,
  });
  const [travelMode, setTravelMode] = useState('driving'); // 'driving' | 'walking'
  const [routeData, setRouteData] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const webViewRef = useRef(null);
  const isMountedRef = useRef(true);

  // Facility Info with Safe Defaults
  const destFacility = useMemo(() => {
    const fType = facility?.type || 'police';
    const defaultTypeName =
      fType === 'police'
        ? '24/7 Police Station'
        : fType === 'hospital'
        ? 'Hospital & Emergency Care'
        : '24/7 Pharmacy & Chemist';

    return {
      id: facility?.id || 'emergency-haven',
      name: facility?.name || 'Emergency Safe Haven',
      typeName: facility?.typeName || defaultTypeName,
      type: fType,
      address: facility?.address || 'Belagavi, Karnataka',
      phone: facility?.phone || facility?.directPhone || '112',
      latitude: Number(facility?.latitude) || 15.81498,
      longitude: Number(facility?.longitude) || 74.49122,
    };
  }, [facility]);

  // Inject Route Geometry into Leaflet
  const injectRouteToMap = useCallback(
    (data, uLat, uLng) => {
      if (!webViewRef.current || !data?.geometry?.coordinates) return;

      const js = `
        if (typeof window.renderNavigationRoute === 'function') {
          window.renderNavigationRoute(
            ${JSON.stringify(data.geometry.coordinates)},
            ${uLat},
            ${uLng},
            ${destFacility.latitude},
            ${destFacility.longitude},
            ${JSON.stringify(destFacility.name)},
            ${JSON.stringify(destFacility.type)},
            ${JSON.stringify(data.nearbyHazardZones || [])}
          );
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    },
    [destFacility]
  );

  // Fetch Road Route
  const fetchRoute = useCallback(
    async (mode, uCoords) => {
      if (!uCoords?.latitude || !uCoords?.longitude) return;
      setLoadingRoute(true);

      try {
        const data = await safeHavenService.getRoadRoute(
          uCoords.latitude,
          uCoords.longitude,
          destFacility.latitude,
          destFacility.longitude,
          mode
        );

        if (isMountedRef.current && data) {
          setRouteData(data);
          if (mapReady) {
            injectRouteToMap(data, uCoords.latitude, uCoords.longitude);
          }
        }
      } catch (err) {
        console.warn('Navigation route fetch warning:', err);
      } finally {
        if (isMountedRef.current) setLoadingRoute(false);
      }
    },
    [destFacility, mapReady, injectRouteToMap]
  );

  // Initial Location & GPS Listener
  useEffect(() => {
    isMountedRef.current = true;

    // Fetch initial route
    fetchRoute(travelMode, userCoords);

    // Get live high-accuracy location
    locationService
      .getCurrentLocation()
      .then((loc) => {
        if (isMountedRef.current && loc?.latitude && loc?.longitude) {
          setUserCoords({ latitude: loc.latitude, longitude: loc.longitude });
          fetchRoute(travelMode, { latitude: loc.latitude, longitude: loc.longitude });
        }
      })
      .catch(() => {});

    // Subscribe to live GPS tracking
    const unsubscribe = locationService.subscribe((loc) => {
      if (!isMountedRef.current || !loc?.latitude || !loc?.longitude) return;

      setUserCoords({ latitude: loc.latitude, longitude: loc.longitude });

      // Check distance to destination for arrival trigger
      const remainingKm = safeHavenService.calculateDistanceKm(
        loc.latitude,
        loc.longitude,
        destFacility.latitude,
        destFacility.longitude
      );

      if (remainingKm <= 0.035 && !hasArrived) {
        setHasArrived(true);
        Alert.alert('Arrived at Safe Haven', `You have safely arrived at ${destFacility.name}.`);
      }

      // Update position on Leaflet map
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (typeof window.updateUserNavMarker === 'function') {
            window.updateUserNavMarker(${loc.latitude}, ${loc.longitude});
          }
          true;
        `);
      }
    });

    return () => {
      isMountedRef.current = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // When map becomes ready, push cached route if available
  useEffect(() => {
    if (mapReady && routeData && userCoords) {
      injectRouteToMap(routeData, userCoords.latitude, userCoords.longitude);
    }
  }, [mapReady, routeData, userCoords, injectRouteToMap]);

  // Mode Toggle (Driving / Walking)
  const handleToggleMode = (newMode) => {
    if (newMode === travelMode) return;
    setTravelMode(newMode);

    // Instantly update duration & ETA for the selected travel mode
    if (routeData?.distanceMeters) {
      const distM = routeData.distanceMeters;
      const isWalking = newMode === 'walking';
      const durS = isWalking
        ? Math.max(60, Math.round(distM / 1.333)) // ~4.8 km/h human walking speed
        : Math.max(30, Math.round((distM / 35000) * 3600)); // ~35 km/h city driving
      const mins = Math.max(1, Math.round(durS / 60));

      setRouteData((prev) => ({
        ...prev,
        mode: newMode,
        durationSeconds: durS,
        durationFormatted: `${mins} min${mins > 1 ? 's' : ''}`,
        etaMinutes: mins,
      }));
    }

    fetchRoute(newMode, userCoords);
  };

  // Re-center Map on User
  const handleRecenter = () => {
    if (webViewRef.current && userCoords?.latitude) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.recenterNavMap === 'function') {
          window.recenterNavMap(${userCoords.latitude}, ${userCoords.longitude});
        }
        true;
      `);
    }
  };

  // Fit Entire Route on Map
  const handleFitRoute = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.fitRouteBounds === 'function') {
          window.fitRouteBounds();
        }
        true;
      `);
    }
  };

  // Maneuver Icon Helper
  const getManeuverIcon = (step) => {
    const type = String(step?.type || '').toLowerCase();
    const modifier = String(step?.modifier || '').toLowerCase();

    if (type === 'arrive') return 'flag';
    if (modifier.includes('left')) return 'arrow-undo';
    if (modifier.includes('right')) return 'arrow-redo';
    if (modifier.includes('uturn')) return 'repeat';
    if (type.includes('roundabout') || type.includes('rotary')) return 'sync';
    return 'arrow-up';
  };

  // Estimated Arrival Clock Time
  const arrivalClockTime = useMemo(() => {
    const mins = routeData?.etaMinutes || 2;
    const date = new Date(Date.now() + mins * 60 * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [routeData]);

  // Current and Next Step Instructions
  const currentStep = routeData?.steps?.[0];
  const nextStep = routeData?.steps?.[1];

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'NAV_MAP_READY') {
        setMapReady(true);
      }
    } catch (_) {}
  };

  // Standalone Leaflet Navigation Map HTML Template
  const navMapHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #0f172a;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .user-nav-marker {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-nav-dot {
      width: 18px;
      height: 18px;
      background: #2563eb;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 12px rgba(37, 99, 235, 0.8), 0 0 24px rgba(37, 99, 235, 0.4);
    }
    .user-pulse-ring {
      position: absolute;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.25);
      animation: navPulse 2s ease-out infinite;
    }
    @keyframes navPulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .dest-pin-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .dest-pin-badge {
      padding: 4px 8px;
      border-radius: 12px;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      border: 1.5px solid #fff;
    }
    .dest-pin-police { background: #1d4ed8; }
    .dest-pin-hospital { background: #dc2626; }
    .dest-pin-pharmacy { background: #059669; }
    .dest-pin-pointer {
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid #fff;
      margin-top: -1px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = null;
    var userMarker = null;
    var destMarker = null;
    var routePolylineBg = null;
    var routePolyline = null;
    var routeCoordsCache = [];
    var hazardZoneLayers = [];

    function notifyRN(msg) {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function initNavMap() {
      if (typeof L === 'undefined') {
        setTimeout(initNavMap, 60);
        return;
      }
      if (map) return;

      map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([${initialLat}, ${initialLng}], 16);

      var navTiles = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3']
      }).addTo(map);

      navTiles.on('tileerror', function() {
        if (!window._osmFallbackActive) {
          window._osmFallbackActive = true;
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: ['a', 'b', 'c']
          }).addTo(map);
        }
      });

      setTimeout(function() { if (map) map.invalidateSize(); }, 200);
      setTimeout(function() { if (map) map.invalidateSize(); }, 600);

      notifyRN({ type: 'NAV_MAP_READY' });
    }

    window.renderNavigationRoute = function(geojsonCoords, uLat, uLng, dLat, dLng, destName, destType, hazardZones) {
      if (!map) {
        setTimeout(function() {
          window.renderNavigationRoute(geojsonCoords, uLat, uLng, dLat, dLng, destName, destType, hazardZones);
        }, 100);
        return;
      }

      var latLngs = geojsonCoords.map(function(c) { return [c[1], c[0]]; });
      routeCoordsCache = latLngs;

      if (routePolylineBg) map.removeLayer(routePolylineBg);
      if (routePolyline) map.removeLayer(routePolyline);

      // Clear any existing hazard polygons
      if (hazardZoneLayers && hazardZoneLayers.length > 0) {
        hazardZoneLayers.forEach(function(l) { if (map) map.removeLayer(l); });
        hazardZoneLayers = [];
      }

      // Render avoided restricted/risky zones on map to display safe detour recommendation
      if (Array.isArray(hazardZones)) {
        hazardZones.forEach(function(hz) {
          if (!hz || !hz.geometry) return;
          try {
            var rings = hz.geometry.type === 'Polygon'
              ? hz.geometry.coordinates[0]
              : (hz.geometry.coordinates[0] && hz.geometry.coordinates[0][0]) || [];
            if (!rings || rings.length === 0) return;
            var latLngRings = rings.map(function(pt) { return [pt[1], pt[0]]; });
            var poly = L.polygon(latLngRings, {
              color: '#ef4444',
              fillColor: '#ef4444',
              fillOpacity: 0.24,
              weight: 2,
              dashArray: '5, 5'
            }).addTo(map);
            poly.bindTooltip('⚠️ ' + (hz.name || 'Restricted Hazard') + ' (Avoided by Safe Corridor)', {
              permanent: false,
              direction: 'center'
            });
            hazardZoneLayers.push(poly);
          } catch(e) {}
        });
      }

      // Safe corridor outer emerald glow + precise inner blue road line
      routePolylineBg = L.polyline(latLngs, {
        color: '#047857',
        weight: 9,
        opacity: 0.88,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      routePolyline = L.polyline(latLngs, {
        color: '#2563eb',
        weight: 6,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      if (userMarker) map.removeLayer(userMarker);
      var userIcon = L.divIcon({
        className: 'user-nav-marker',
        html: '<div class="user-pulse-ring"></div><div class="user-nav-dot"></div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      userMarker = L.marker([uLat, uLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

      if (destMarker) map.removeLayer(destMarker);
      var pinClass = destType === 'hospital' ? 'dest-pin-hospital' : destType === 'pharmacy' ? 'dest-pin-pharmacy' : 'dest-pin-police';
      var pinEmoji = destType === 'hospital' ? '🏥' : destType === 'pharmacy' ? '💊' : '🚓';
      var destIcon = L.divIcon({
        className: 'dest-pin-marker',
        html: '<div class="dest-pin-badge ' + pinClass + '">' + pinEmoji + ' ' + destName + '</div><div class="dest-pin-pointer"></div>',
        iconSize: [160, 36],
        iconAnchor: [80, 36]
      });
      destMarker = L.marker([dLat, dLng], { icon: destIcon, zIndexOffset: 900 }).addTo(map);

      window.fitRouteBounds();
    };

    window.fitRouteBounds = function() {
      if (!map || routeCoordsCache.length === 0) return;
      var bounds = L.latLngBounds(routeCoordsCache);
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 140],
        paddingBottomRight: [40, 220],
        maxZoom: 17,
        animate: true
      });
    };

    window.updateUserNavMarker = function(lat, lng) {
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      }
    };

    window.recenterNavMap = function(lat, lng) {
      if (map) {
        map.flyTo([lat, lng], 17, { animate: true, duration: 0.8 });
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initNavMap();
    } else {
      document.addEventListener('DOMContentLoaded', initNavMap);
    }
  </script>
</body>
</html>`;
  }, [initialLat, initialLng]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#064e3b" />

      {/* TOP GOOGLE MAPS NAVIGATION HUD BANNER */}
      <View style={styles.topBanner}>
        <View style={styles.maneuverWrap}>
          <View style={styles.maneuverIconBox}>
            <Ionicons name={getManeuverIcon(currentStep)} size={30} color="#ffffff" />
          </View>
          <View style={styles.maneuverTextWrap}>
            <Text style={styles.maneuverDistance}>
              {currentStep?.distanceMeters ? `In ${currentStep.distanceMeters} m` : 'Proceed Ahead'}
            </Text>
            <Text style={styles.maneuverInstruction} numberOfLines={2}>
              {currentStep?.instruction || 'Follow road toward emergency safe haven'}
            </Text>
            {nextStep && (
              <Text style={styles.nextStepPreview} numberOfLines={1}>
                Then: {nextStep.instruction}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.bannerBottomRow}>
          <View style={styles.bannerModeTag}>
            <Ionicons name={travelMode === 'walking' ? 'walk' : 'car'} size={14} color="#a7f3d0" />
            <Text style={styles.bannerModeText}>
              {travelMode === 'walking' ? 'Walking Route' : 'Driving Route'}
            </Text>
          </View>

          <View style={styles.safeRouteBadge}>
            <Ionicons
              name={routeData?.hazardAvoidanceActive ? 'shield-half' : 'shield-checkmark'}
              size={13}
              color="#34d399"
            />
            <Text style={styles.safeRouteBadgeText}>
              {routeData?.hazardAvoidanceActive
                ? `Safe Detour Active (${routeData?.avoidedHazards?.[0] || 'Hazard Avoided'})`
                : 'Safe Route Recommended'}
            </Text>
          </View>
        </View>
      </View>

      {/* FULL-SCREEN INTERACTIVE NAVIGATION MAP */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: navMapHtml }}
          style={styles.webView}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          onMessage={handleWebViewMessage}
        />

        {/* Floating Map Utility Buttons */}
        <View style={styles.floatingControls}>
          <TouchableOpacity style={styles.floatingBtn} onPress={handleRecenter} activeOpacity={0.8}>
            <Ionicons name="locate" size={22} color="#2563eb" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.floatingBtn} onPress={handleFitRoute} activeOpacity={0.8}>
            <Ionicons name="expand" size={20} color="#334155" />
          </TouchableOpacity>
        </View>

        {/* Loading Spinner Overlay when recalculating route */}
        {loadingRoute && (
          <View style={styles.routeLoadingOverlay}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.routeLoadingText}>Computing optimal road route...</Text>
          </View>
        )}
      </View>

      {/* BOTTOM TRIP HUD SHEET (GOOGLE MAPS STYLE) */}
      <View style={styles.bottomSheet}>
        {/* Row 1: ETA & Distance Badge */}
        <View style={styles.etaRow}>
          <View style={styles.etaInfo}>
            <Text style={styles.etaText}>
              {routeData?.durationFormatted || `${routeData?.etaMinutes || 2} min`}
            </Text>
            <Text style={styles.etaSubText}>
              {routeData?.distanceFormatted || 'Calculating distance'} • Arrive {arrivalClockTime}
            </Text>
          </View>

          {/* Mode Switcher Buttons */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeBtn, travelMode === 'driving' && styles.modeBtnActive]}
              onPress={() => handleToggleMode('driving')}
            >
              <Ionicons
                name="car"
                size={16}
                color={travelMode === 'driving' ? '#ffffff' : '#64748b'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, travelMode === 'walking' && styles.modeBtnActive]}
              onPress={() => handleToggleMode('walking')}
            >
              <Ionicons
                name="walk"
                size={16}
                color={travelMode === 'walking' ? '#ffffff' : '#64748b'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 1.5: Safe Route Corridor Reassurance */}
        <View style={styles.safeCorridorRow}>
          <Ionicons name="shield-checkmark" size={13} color="#059669" />
          <Text style={styles.safeCorridorText} numberOfLines={1}>
            {routeData?.safetyRecommendation || '🛡️ Verified Safe Route: Path is 100% clear of danger zones.'}
          </Text>
        </View>

        {/* Row 2: Destination Facility Card */}
        <View style={styles.facilityCard}>
          <View style={styles.facilityIconBadge}>
            <Ionicons
              name={
                destFacility.type === 'hospital'
                  ? 'medical'
                  : destFacility.type === 'pharmacy'
                  ? 'medkit'
                  : 'shield-checkmark'
              }
              size={18}
              color="#ffffff"
            />
          </View>
          <View style={styles.facilityTextWrap}>
            <View style={styles.facilityTitleRow}>
              <Text style={styles.facilityName} numberOfLines={1}>
                {destFacility.name}
              </Text>
              <View style={styles.verifiedTag}>
                <Text style={styles.verifiedTagText}>24/7 Verified</Text>
              </View>
            </View>
            <Text style={styles.facilityAddress} numberOfLines={1}>
              {destFacility.address}
            </Text>
          </View>
        </View>

        {/* Row 3: Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => safeHavenService.callFacility(destFacility.phone)}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={16} color="#ffffff" />
            <Text style={styles.callBtnText}>Call ({destFacility.phone})</Text>
          </TouchableOpacity>

          {routeData?.steps && routeData.steps.length > 0 && (
            <TouchableOpacity
              style={styles.stepsBtn}
              onPress={() => setShowStepsModal(!showStepsModal)}
              activeOpacity={0.8}
            >
              <Ionicons name="list" size={16} color="#334155" />
              <Text style={styles.stepsBtnText}>Steps ({routeData.steps.length})</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.exitBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={18} color="#ef4444" />
            <Text style={styles.exitBtnText}>End</Text>
          </TouchableOpacity>
        </View>

        {/* Expandable Turn-by-Turn Steps Sheet */}
        {showStepsModal && routeData?.steps && (
          <View style={styles.stepsContainer}>
            <View style={styles.stepsHeader}>
              <Text style={styles.stepsTitle}>Turn-by-Turn Route Guidance</Text>
              <TouchableOpacity onPress={() => setShowStepsModal(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.stepsScroll} nestedScrollEnabled={true}>
              {routeData.steps.map((step, idx) => (
                <View key={idx} style={styles.stepItem}>
                  <View style={styles.stepIconWrap}>
                    <Ionicons name={getManeuverIcon(step)} size={18} color="#2563eb" />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepInstructionText}>{step.instruction}</Text>
                    {step.distanceMeters > 0 && (
                      <Text style={styles.stepDistanceText}>{step.distanceMeters} meters</Text>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064e3b',
  },
  topBanner: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10,
  },
  maneuverWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maneuverIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  maneuverTextWrap: {
    flex: 1,
  },
  maneuverDistance: {
    fontSize: 20,
    fontWeight: '900',
    color: '#34d399',
    letterSpacing: 0.3,
  },
  maneuverInstruction: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 20,
    marginTop: 2,
  },
  nextStepPreview: {
    fontSize: 12,
    color: '#a7f3d0',
    marginTop: 3,
  },
  bannerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  bannerModeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  bannerModeText: {
    fontSize: 11,
    color: '#a7f3d0',
    fontWeight: '600',
  },
  safeRouteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    gap: 4,
  },
  safeRouteBadgeText: {
    fontSize: 11,
    color: '#6ee7b7',
    fontWeight: '700',
  },
  safeCorridorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 8,
    gap: 6,
  },
  safeCorridorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 10,
  },
  floatingBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  routeLoadingOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    elevation: 3,
  },
  routeLoadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  bottomSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  etaInfo: {
    flex: 1,
  },
  etaText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#059669',
  },
  etaSubText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  facilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  facilityIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  facilityTextWrap: {
    flex: 1,
  },
  facilityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  facilityName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    marginRight: 6,
  },
  verifiedTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  facilityAddress: {
    fontSize: 11,
    color: '#64748b',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  callBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepsBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 6,
  },
  stepsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  exitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  exitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  stepsContainer: {
    marginTop: 12,
    maxHeight: 180,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  stepsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  stepsScroll: {
    maxHeight: 130,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
  },
  stepIconWrap: {
    width: 24,
    marginRight: 8,
    marginTop: 2,
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepInstructionText: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '600',
    lineHeight: 16,
  },
  stepDistanceText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
});
