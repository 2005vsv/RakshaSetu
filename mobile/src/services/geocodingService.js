import apiClient from './apiClient';

// Built-in instant suggestions for popular Indian tourist destinations & landmarks
export const POPULAR_INDIAN_DESTINATIONS = [
  {
    name: 'Taj Mahal',
    displayName: 'Taj Mahal, Agra, Uttar Pradesh',
    city: 'Agra',
    state: 'Uttar Pradesh',
    latitude: 27.1750075,
    longitude: 78.0421013,
  },
  {
    name: 'India Gate',
    displayName: 'India Gate, Rajpath, New Delhi, Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.612912,
    longitude: 77.2295097,
  },
  {
    name: 'Gateway of India',
    displayName: 'Gateway of India, Colaba, Mumbai, Maharashtra',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 18.9219661,
    longitude: 72.8345657,
  },
  {
    name: 'Hawa Mahal',
    displayName: 'Hawa Mahal, Badi Choupad, Jaipur, Rajasthan',
    city: 'Jaipur',
    state: 'Rajasthan',
    latitude: 26.923932,
    longitude: 75.8268652,
  },
  {
    name: 'Calangute Beach',
    displayName: 'Calangute Beach, North Goa, Goa',
    city: 'Calangute',
    state: 'Goa',
    latitude: 15.543419,
    longitude: 73.755325,
  },
  {
    name: 'Baga Beach',
    displayName: 'Baga Beach, North Goa, Goa',
    city: 'Baga',
    state: 'Goa',
    latitude: 15.5553,
    longitude: 73.7517,
  },
  {
    name: 'Bengaluru Palace',
    displayName: 'Bengaluru Palace, Vasanth Nagar, Bengaluru, Karnataka',
    city: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9988,
    longitude: 77.5921,
  },
  {
    name: 'Mysore Palace',
    displayName: 'Mysore Palace, Sayyaji Rao Rd, Mysuru, Karnataka',
    city: 'Mysuru',
    state: 'Karnataka',
    latitude: 12.3051,
    longitude: 76.6551,
  },
  {
    name: 'Golden Temple',
    displayName: 'Golden Temple (Harmandir Sahib), Amritsar, Punjab',
    city: 'Amritsar',
    state: 'Punjab',
    latitude: 31.6200,
    longitude: 74.8765,
  },
  {
    name: 'Kashi Vishwanath Temple',
    displayName: 'Kashi Vishwanath Temple, Lahori Tola, Varanasi, Uttar Pradesh',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    latitude: 25.3109,
    longitude: 83.0107,
  },
  {
    name: 'Mall Road Manali',
    displayName: 'The Mall Road, Manali, Himachal Pradesh',
    city: 'Manali',
    state: 'Himachal Pradesh',
    latitude: 32.2444,
    longitude: 77.1896,
  },
  {
    name: 'Belagavi Fort',
    displayName: 'Belgaum Fort, Fort Road, Belagavi, Karnataka',
    city: 'Belagavi',
    state: 'Karnataka',
    latitude: 15.8584,
    longitude: 74.5242,
  },
  {
    name: 'Gogte Institute of Technology',
    displayName: 'KLS Gogte Institute of Technology, Udyambag, Belagavi, Karnataka',
    city: 'Belagavi',
    state: 'Karnataka',
    latitude: 15.81527,
    longitude: 74.48744,
  },
  {
    name: 'Tilakwadi Police Station',
    displayName: 'Tilakwadi Police Station, Guruwar Peth, Belagavi, Karnataka',
    city: 'Belagavi',
    state: 'Karnataka',
    latitude: 15.835939,
    longitude: 74.501521,
  },
  {
    name: 'Belagavi Railway Station',
    displayName: 'Belagavi Railway Station, Station Rd, Belagavi, Karnataka',
    city: 'Belagavi',
    state: 'Karnataka',
    latitude: 15.8580,
    longitude: 74.5090,
  },
];

class GeocodingService {
  /**
   * Search places anywhere across India with instant Google-Maps style autocomplete
   */
  async searchPlaces(query) {
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return [];
    }

    const q = query.trim().toLowerCase();

    // 1. Instant local matching for common destinations (zero latency)
    const localMatches = POPULAR_INDIAN_DESTINATIONS.filter((item) => {
      const haystack = `${item.name} ${item.displayName} ${item.city} ${item.state}`.toLowerCase();
      return haystack.includes(q);
    });

    // 2. Query backend geocoding endpoint or direct Photon OSM
    try {
      const res = await apiClient.get('/locations/search', {
        params: { q: query.trim(), limit: 6 },
        timeout: 4000,
      });

      if (res?.data?.success && Array.isArray(res.data.suggestions) && res.data.suggestions.length > 0) {
        // Merge with local matches avoiding duplicates by name
        const seen = new Set();
        const merged = [];

        for (const item of [...res.data.suggestions, ...localMatches]) {
          const key = (item.name || item.displayName || '').toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        }
        return merged.slice(0, 6);
      }
    } catch (_) {
      // Backend search unavailable, try direct public Photon Komoot API fallback
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=6&bbox=68.1,6.7,97.4,35.5`;
        const directRes = await fetch(photonUrl);
        const json = await directRes.json();

        if (json && Array.isArray(json.features)) {
          const directItems = json.features.map((f) => {
            const p = f.properties || {};
            const name = p.name || p.street || p.city || query;
            const subtitle = [p.street, p.city || p.district, p.state, 'India'].filter(Boolean).join(', ');
            return {
              name,
              displayName: subtitle ? `${name}, ${subtitle}` : name,
              city: p.city || p.district || '',
              state: p.state || '',
              latitude: f.geometry.coordinates[1],
              longitude: f.geometry.coordinates[0],
            };
          });

          if (directItems.length > 0) {
            return directItems.slice(0, 6);
          }
        }
      } catch (err) {
        console.warn('Direct geocoding fallback warning:', err.message);
      }
    }

    return localMatches.slice(0, 6);
  }

  /**
   * Resolve any destination or start location string to coordinates
   */
  async resolveCoordinates(locStr, fallbackCoords = null) {
    if (!locStr) return fallbackCoords;
    const str = String(locStr).trim();

    // Check if input is "current location"
    if (
      str.toLowerCase() === 'current location' ||
      str.toLowerCase() === 'current live location' ||
      str.toLowerCase() === 'live location' ||
      str.toLowerCase() === 'my location'
    ) {
      return fallbackCoords;
    }

    // Check numeric coordinates e.g. "15.8340, 74.5047"
    const coordMatch = str.match(/([0-9]+\.[0-9]+)[,\s]+([0-9]+\.[0-9]+)/);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }

    // Check built-in Indian destinations
    const lower = str.toLowerCase();
    const localHit = POPULAR_INDIAN_DESTINATIONS.find((item) => {
      return lower.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(lower);
    });
    if (localHit) {
      return { latitude: localHit.latitude, longitude: localHit.longitude };
    }

    // Query online geocoding
    try {
      const results = await this.searchPlaces(str);
      if (results && results.length > 0) {
        return { latitude: results[0].latitude, longitude: results[0].longitude };
      }
    } catch (_) {}

    return fallbackCoords;
  }
}

export default new GeocodingService();

