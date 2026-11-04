import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../theme/colors';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import geocodingService from '../../services/geocodingService';

const travelModes = [
  { key: 'car', label: 'Car', icon: 'car-outline' },
  { key: 'bus', label: 'Bus', icon: 'bus-outline' },
  { key: 'train', label: 'Train', icon: 'train-outline' },
  { key: 'flight', label: 'Flight', icon: 'airplane-outline' },
  { key: 'trekking', label: 'Trek', icon: 'walk-outline' },
  { key: 'other', label: 'Other', icon: 'navigate-outline' },
];

export default function TripsScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyTripId, setBusyTripId] = useState(null);

  // Filters & Search
  const [filter, setFilter] = useState('all'); // 'all' | 'planned' | 'active' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [startPoint, setStartPoint] = useState('');
  const [destination, setDestination] = useState('');
  const [travelMode, setTravelMode] = useState('car');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [additionalDestinations, setAdditionalDestinations] = useState([]);
  const [newStopText, setNewStopText] = useState('');

  // Autocomplete search suggestions state
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  const handleStartTextChange = async (text) => {
    setStartPoint(text);
    if (!text || text.trim().length < 2) {
      setStartSuggestions([]);
      return;
    }
    try {
      setIsSearchingStart(true);
      const results = await geocodingService.searchPlaces(text);
      setStartSuggestions(Array.isArray(results) ? results.slice(0, 5) : []);
    } catch (_) {
      setStartSuggestions([]);
    } finally {
      setIsSearchingStart(false);
    }
  };

  const handleDestTextChange = async (text) => {
    setDestination(text);
    if (!text || text.trim().length < 2) {
      setDestSuggestions([]);
      return;
    }
    try {
      setIsSearchingDest(true);
      const results = await geocodingService.searchPlaces(text);
      setDestSuggestions(Array.isArray(results) ? results.slice(0, 5) : []);
    } catch (_) {
      setDestSuggestions([]);
    } finally {
      setIsSearchingDest(false);
    }
  };

  const selectStartPlace = (item) => {
    setStartPoint(item.displayName || item.name);
    setStartSuggestions([]);
  };

  const selectDestPlace = (item) => {
    setDestination(item.displayName || item.name);
    setDestSuggestions([]);
  };

  const fetchTrips = useCallback(async () => {
    try {
      const res = await apiClient.get(API_ENDPOINTS.TRIPS);
      const tripList = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.trips)
        ? res.data.trips
        : [];
      setTrips(tripList);
    } catch (e) {
      console.warn('Trips fetch error:', e.message);
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const handleAddStop = () => {
    if (newStopText.trim()) {
      setAdditionalDestinations((prev) => [...prev, newStopText.trim()]);
      setNewStopText('');
    }
  };

  const handleRemoveStop = (idx) => {
    setAdditionalDestinations((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateTrip = async () => {
    if (!destination.trim()) {
      Alert.alert('Required', 'Please enter a trip destination.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        startPoint: startPoint.trim() || 'Current Location',
        destination: destination.trim(),
        modeOfTravel: travelMode,
        travelMode,
        description: description.trim(),
        status: 'planned',
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || undefined,
        additionalDestinations,
      };

      const res = await apiClient.post(API_ENDPOINTS.TRIPS, payload);
      setTrips((prev) => [res.data, ...prev]);
      setShowAddModal(false);
      setStartPoint('');
      setDestination('');
      setDescription('');
      setAdditionalDestinations([]);
      setNewStopText('');
      Alert.alert('Trip Planned', `Safe travels! Your trip to ${destination} is registered with safety monitoring.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not save trip.');
    } finally {
      setSubmitting(false);
    }
  };

  // Status transitions: planned -> active -> completed (Web Parity)
  const handleUpdateStatus = async (trip, newStatus) => {
    const tripId = trip?._id || trip?.id;
    if (!tripId) return;
    setBusyTripId(tripId);
    try {
      await apiClient.patch(API_ENDPOINTS.TRIP_DETAIL(tripId), { status: newStatus });
      setTrips((prev) =>
        prev.map((t) => (t._id === tripId || t.id === tripId ? { ...t, status: newStatus } : t))
      );
      Alert.alert(
        newStatus === 'active' ? 'Trip Started' : 'Trip Completed',
        `Status updated to ${newStatus.toUpperCase()}. Safety responders notified.`
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not update trip status.');
    } finally {
      setBusyTripId(null);
    }
  };

  const handleDeleteTrip = (id) => {
    Alert.alert('Delete Trip', 'Are you sure you want to remove this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(API_ENDPOINTS.TRIP_DETAIL(id));
            setTrips((prev) => prev.filter((t) => t._id !== id && t.id !== id));
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to delete trip.');
          }
        },
      },
    ]);
  };

  const handleTrackJourney = () => {
    if (navigation && navigation.navigate) {
      navigation.navigate('MapTab');
    }
  };

  // Filter & Search Logic
  const safeTrips = Array.isArray(trips) ? trips : [];
  const filteredTrips = safeTrips.filter((t) => {
    if (!t) return false;
    const matchesFilter = filter === 'all' || String(t.status || 'planned').toLowerCase() === filter;
    const searchHaystack = `${t.destination || ''} ${t.startPoint || ''} ${t.description || ''} ${(t.additionalDestinations || []).join(' ')}`.toLowerCase();
    const matchesSearch = !searchQuery.trim() || searchHaystack.includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <View style={styles.container}>
      <ScrollView
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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>My Trips & Itineraries</Text>
            <Text style={styles.headerSubtitle}>
              Registered travel routes & emergency location checkpoints
            </Text>
          </View>
          <TouchableOpacity style={styles.newTripBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={18} color={Colors.white} />
            <Text style={styles.newTripBtnText}>Plan Trip</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search destination, stops, notes..."
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

        {/* Filter Chips (Web Parity) */}
        <View style={styles.filterRow}>
          {[
            { key: 'all', label: 'All' },
            { key: 'planned', label: 'Planned' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, filter === tab.key && styles.filterChipActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.filterChipText, filter === tab.key && styles.filterChipTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : filteredTrips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trail-sign-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Trips Found</Text>
            <Text style={styles.emptyDesc}>
              {searchQuery || filter !== 'all'
                ? 'No trips match your current filter or query.'
                : 'Register your travel routes so police responders and control rooms can monitor your safety.'}
            </Text>
          </View>
        ) : (
          filteredTrips.map((trip, idx) => {
            const tripId = trip?._id || trip?.id || `trip-${idx}`;
            const statusStr = String(trip?.status || 'planned').toLowerCase();
            const isBusy = busyTripId === tripId;

            return (
              <View key={tripId} style={styles.tripCard}>
                <View style={styles.tripCardHeader}>
                  <View style={styles.modeBadge}>
                    <Ionicons name="navigate" size={13} color={Colors.primary} />
                    <Text style={styles.modeText}>
                      {String(trip?.modeOfTravel || trip?.travelMode || 'ROAD').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={[
                        styles.statusPill,
                        statusStr === 'completed'
                          ? styles.statusPillSuccess
                          : statusStr === 'active'
                          ? styles.statusPillWarning
                          : styles.statusPillInfo,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          statusStr === 'completed'
                            ? { color: Colors.success }
                            : statusStr === 'active'
                            ? { color: Colors.warning }
                            : { color: Colors.primary },
                        ]}
                      >
                        {statusStr.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteTrip(tripId)}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.destinationTitle}>
                  {trip?.startPoint ? `${trip.startPoint} ➔ ` : ''}
                  {trip?.destination || 'Destination'}
                </Text>

                {trip?.description ? <Text style={styles.tripDesc}>{trip.description}</Text> : null}

                {/* Additional Destination Stops */}
                {Array.isArray(trip?.additionalDestinations) && trip.additionalDestinations.length > 0 && (
                  <View style={styles.stopsRow}>
                    <Text style={styles.stopsLabel}>Stops:</Text>
                    {trip.additionalDestinations.map((stop, sIdx) => (
                      <View key={sIdx} style={styles.stopChip}>
                        <Text style={styles.stopChipText}>📍 {stop}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.tripFooter}>
                  <Text style={styles.tripDateText}>
                    📅 {trip?.startDate ? new Date(trip.startDate).toLocaleDateString() : 'Planned'}
                    {trip?.endDate ? ` - ${new Date(trip.endDate).toLocaleDateString()}` : ''}
                  </Text>
                </View>

                {/* Status Transition Action Buttons (Web Parity) */}
                <View style={styles.actionRow}>
                  {statusStr === 'planned' && (
                    <TouchableOpacity
                      style={styles.actionBtnPrimary}
                      onPress={() => handleUpdateStatus(trip, 'active')}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                      ) : (
                        <>
                          <Ionicons name="play" size={14} color={Colors.white} style={{ marginRight: 4 }} />
                          <Text style={styles.actionBtnText}>Start Trip</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {statusStr === 'active' && (
                    <TouchableOpacity
                      style={styles.actionBtnSuccess}
                      onPress={() => handleUpdateStatus(trip, 'completed')}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={14} color={Colors.white} style={{ marginRight: 4 }} />
                          <Text style={styles.actionBtnText}>Complete Trip</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleTrackJourney}>
                    <Ionicons name="map-outline" size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.actionBtnSecondaryText}>Track Journey</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Plan Trip Modal (Enhanced UI with Place Autocomplete & Keyboard Avoiding) */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Plan New Travel Route</Text>
                <Text style={styles.modalSubtitle}>Search destinations & register safety route</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setStartSuggestions([]);
                  setDestSuggestions([]);
                  setShowAddModal(false);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 80 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Quick Destination Chips */}
              <Text style={styles.quickChipsTitle}>⚡ Popular Destinations (Tap to select):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickChipsScroll}>
                {['Taj Mahal', 'India Gate', 'Calangute Beach Goa', 'Belagavi Fort', 'Hampi Heritage', 'Kaziranga'].map((place) => (
                  <TouchableOpacity
                    key={place}
                    style={styles.quickChip}
                    onPress={() => {
                      setDestination(place);
                      setDestSuggestions([]);
                    }}
                  >
                    <Text style={styles.quickChipText}>📍 {place}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Starting Location with Live Autocomplete */}
              <Text style={styles.inputLabel}>Starting Location (Origin)</Text>
              <View style={styles.inputWithIconWrap}>
                <Ionicons name="navigate-outline" size={18} color="#38bdf8" style={styles.inputLeadingIcon} />
                <TextInput
                  style={[styles.modalInput, styles.modalInputWithIcon]}
                  placeholder="e.g. Guwahati Hotel, Belagavi Airport, etc."
                  placeholderTextColor={Colors.textMuted}
                  value={startPoint}
                  onChangeText={handleStartTextChange}
                />
                {isSearchingStart && <ActivityIndicator size="small" color="#38bdf8" style={styles.inputTrailingSpinner} />}
              </View>

              {/* Starting Location Suggestions Dropdown */}
              {startSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {startSuggestions.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.suggestionItem,
                        idx === startSuggestions.length - 1 && styles.suggestionItemLast,
                      ]}
                      onPress={() => selectStartPlace(item)}
                    >
                      <Ionicons name="location" size={16} color="#38bdf8" style={{ marginRight: 8, marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTitle}>{item.name}</Text>
                        <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                          {item.displayName || [item.city, item.state, 'India'].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Main Destination with Live Autocomplete */}
              <Text style={styles.inputLabel}>Main Destination *</Text>
              <View style={styles.inputWithIconWrap}>
                <Ionicons name="flag-outline" size={18} color="#ec4899" style={styles.inputLeadingIcon} />
                <TextInput
                  style={[styles.modalInput, styles.modalInputWithIcon]}
                  placeholder="e.g. Kaziranga National Park, Taj Mahal..."
                  placeholderTextColor={Colors.textMuted}
                  value={destination}
                  onChangeText={handleDestTextChange}
                />
                {isSearchingDest && <ActivityIndicator size="small" color="#ec4899" style={styles.inputTrailingSpinner} />}
              </View>

              {/* Main Destination Suggestions Dropdown */}
              {destSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {destSuggestions.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.suggestionItem,
                        idx === destSuggestions.length - 1 && styles.suggestionItemLast,
                      ]}
                      onPress={() => selectDestPlace(item)}
                    >
                      <Ionicons name="location" size={16} color="#ec4899" style={{ marginRight: 8, marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTitle}>{item.name}</Text>
                        <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                          {item.displayName || [item.city, item.state, 'India'].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Dates Row */}
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="2026-11-04"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="2026-11-10"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Travel Mode</Text>
              <View style={styles.modeSelector}>
                {travelModes.map((m) => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modeOption, travelMode === m.key && styles.modeOptionSelected]}
                    onPress={() => setTravelMode(m.key)}
                  >
                    <Ionicons
                      name={m.icon}
                      size={14}
                      color={travelMode === m.key ? Colors.white : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeOptionText,
                        travelMode === m.key && styles.modeOptionTextSelected,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Additional Stops (Optional)</Text>
              <View style={styles.addStopRow}>
                <TextInput
                  style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. Pobitora Wildlife Sanctuary"
                  placeholderTextColor={Colors.textMuted}
                  value={newStopText}
                  onChangeText={setNewStopText}
                />
                <TouchableOpacity style={styles.addStopBtn} onPress={handleAddStop}>
                  <Text style={styles.addStopBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              {additionalDestinations.length > 0 && (
                <View style={styles.modalStopsList}>
                  {additionalDestinations.map((stop, sIdx) => (
                    <View key={sIdx} style={styles.modalStopChip}>
                      <Text style={styles.modalStopChipText}>📍 {stop}</Text>
                      <TouchableOpacity onPress={() => handleRemoveStop(sIdx)}>
                        <Ionicons name="close" size={14} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.inputLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Accommodations, emergency contacts on route..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />

              <TouchableOpacity
                style={styles.createTripBtn}
                onPress={handleCreateTrip}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.createTripBtnText}>Register Trip Route</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  headerRow: {
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
  newTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  newTripBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
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
    marginBottom: 14,
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
  tripCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  modeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPillWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusPillInfo: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  destinationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  tripDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  stopsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  stopsLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  stopChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  stopChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  tripFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
    marginBottom: 10,
  },
  tripDateText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnSuccess: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnSecondaryText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 5,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: 'row',
  },
  modeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  modeOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeOptionText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  modeOptionTextSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  addStopRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addStopBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStopBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  modalStopsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  modalStopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  modalStopChipText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  createTripBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  createTripBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  modalSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  quickChipsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 2,
  },
  quickChipsScroll: {
    marginBottom: 10,
  },
  quickChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38bdf8',
  },
  inputWithIconWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputLeadingIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 2,
  },
  inputTrailingSpinner: {
    position: 'absolute',
    right: 12,
    zIndex: 2,
  },
  modalInputWithIcon: {
    paddingLeft: 38,
    paddingRight: 38,
  },
  suggestionsContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
