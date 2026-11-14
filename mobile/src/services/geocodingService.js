import apiClient from './apiClient';

// Built-in instant suggestions for popular Indian tourist destinations, cities & landmarks (Google Maps style)
export const POPULAR_INDIAN_DESTINATIONS = [
  // Karnataka (Belagavi Region & Top Hubs)
  {
    name: 'Belagavi',
    displayName: 'Belagavi (Belgaum), Belagavi District, Karnataka, India',
    city: 'Belagavi',
    state: 'Karnataka',
    latitude: 15.8497,
    longitude: 74.4977,
  },
  {
    name: 'Belagavi Fort',
    displayName: 'Belgaum Fort, Fort Road, Belagavi, Karnataka, India',
    city: 'Belagavi',
    state: 'Karnataka',
    latitude: 15.8584,
    longitude: 74.5242,
  },
  {
    name: 'KLS Gogte Institute of Technology',
    displayName: 'KLS Gogte Institute of Technology, Udyambag, Belagavi, Karnataka',
    city: 'Belagavi',
    state: 'Karnataka',
    latitude: 15.81527,
    longitude: 74.48744,
  },
  {
    name: 'Tilakwadi',
    displayName: 'Tilakwadi, Belagavi, Karnataka, 590006, India',
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
  {
    name: 'Jamkhandi',
    displayName: 'Jamkhandi, Bagalkote District, Karnataka, 587301, India',
    city: 'Jamkhandi',
    state: 'Karnataka',
    latitude: 16.5052,
    longitude: 75.2974,
  },
  {
    name: 'Gangavathi',
    displayName: 'Gangavathi, Koppal District, Karnataka, 583227, India',
    city: 'Gangavathi',
    state: 'Karnataka',
    latitude: 15.4312,
    longitude: 76.5317,
  },
  {
    name: 'Hubballi (Hubli)',
    displayName: 'Hubballi, Dharwad District, Karnataka, India',
    city: 'Hubballi',
    state: 'Karnataka',
    latitude: 15.3647,
    longitude: 75.1240,
  },
  {
    name: 'Dharwad',
    displayName: 'Dharwad, Dharwad District, Karnataka, India',
    city: 'Dharwad',
    state: 'Karnataka',
    latitude: 15.4589,
    longitude: 75.0078,
  },
  {
    name: 'Bengaluru (Bangalore)',
    displayName: 'Bengaluru, Bengaluru Urban, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
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
    name: 'Mysuru (Mysore)',
    displayName: 'Mysuru, Mysuru District, Karnataka, India',
    city: 'Mysuru',
    state: 'Karnataka',
    latitude: 12.2958,
    longitude: 76.6394,
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
    name: 'Hampi',
    displayName: 'Hampi, Vijayanagara District, Karnataka, 583239, India',
    city: 'Hampi',
    state: 'Karnataka',
    latitude: 15.3350,
    longitude: 76.4600,
  },
  {
    name: 'Gokak Falls',
    displayName: 'Gokak Falls, Ghataprabha River, Gokak, Belagavi, Karnataka',
    city: 'Gokak',
    state: 'Karnataka',
    latitude: 16.1750,
    longitude: 74.8360,
  },
  {
    name: 'Dandeli',
    displayName: 'Dandeli River Rafting & Forest, Uttara Kannada, Karnataka',
    city: 'Dandeli',
    state: 'Karnataka',
    latitude: 15.2427,
    longitude: 74.6230,
  },
  {
    name: 'Gokarna',
    displayName: 'Gokarna Beach & Mahabaleshwar Temple, Uttara Kannada, Karnataka',
    city: 'Gokarna',
    state: 'Karnataka',
    latitude: 14.5479,
    longitude: 74.3188,
  },
  {
    name: 'Murudeshwar Temple',
    displayName: 'Murudeshwar Shiva Temple & Beach, Uttara Kannada, Karnataka',
    city: 'Murudeshwar',
    state: 'Karnataka',
    latitude: 14.0942,
    longitude: 74.4849,
  },
  {
    name: 'Mangaluru (Mangalore)',
    displayName: 'Mangaluru, Dakshina Kannada, Karnataka, India',
    city: 'Mangaluru',
    state: 'Karnataka',
    latitude: 12.9141,
    longitude: 74.8560,
  },
  {
    name: 'Coorg (Madikeri)',
    displayName: 'Madikeri, Kodagu (Coorg), Karnataka, India',
    city: 'Madikeri',
    state: 'Karnataka',
    latitude: 12.4244,
    longitude: 75.7382,
  },
  {
    name: 'Chikmagalur',
    displayName: 'Chikmagalur Coffee Hills, Chikkamagaluru, Karnataka, India',
    city: 'Chikmagalur',
    state: 'Karnataka',
    latitude: 13.3161,
    longitude: 75.7720,
  },
  {
    name: 'Badami Caves',
    displayName: 'Badami Cave Temples, Bagalkote District, Karnataka',
    city: 'Badami',
    state: 'Karnataka',
    latitude: 15.9187,
    longitude: 75.6766,
  },
  {
    name: 'Vijayapura (Bijapur)',
    displayName: 'Gol Gumbaz, Vijayapura, Karnataka, India',
    city: 'Vijayapura',
    state: 'Karnataka',
    latitude: 16.8302,
    longitude: 75.7100,
  },

  // Goa
  {
    name: 'Goa',
    displayName: 'Goa, Western Coastal India',
    city: 'Goa',
    state: 'Goa',
    latitude: 15.2993,
    longitude: 74.1240,
  },
  {
    name: 'Panaji (Panjim)',
    displayName: 'Panaji, North Goa, Goa, India',
    city: 'Panaji',
    state: 'Goa',
    latitude: 15.4909,
    longitude: 73.8278,
  },
  {
    name: 'Calangute Beach',
    displayName: 'Calangute Beach, Bardez, North Goa, Goa, India',
    city: 'Calangute',
    state: 'Goa',
    latitude: 15.5434,
    longitude: 73.7553,
  },
  {
    name: 'Baga Beach',
    displayName: 'Baga Beach, North Goa, Goa, 403516, India',
    city: 'Baga',
    state: 'Goa',
    latitude: 15.5553,
    longitude: 73.7517,
  },
  {
    name: 'Fort Aguada',
    displayName: 'Fort Aguada & Lighthouse, Candolim, Sinquerim, Goa',
    city: 'Candolim',
    state: 'Goa',
    latitude: 15.4924,
    longitude: 73.7736,
  },
  {
    name: 'Basilica of Bom Jesus',
    displayName: 'Basilica of Bom Jesus, Old Goa, Goa, 403402, India',
    city: 'Old Goa',
    state: 'Goa',
    latitude: 15.5009,
    longitude: 73.9116,
  },
  {
    name: 'Dudhsagar Falls',
    displayName: 'Dudhsagar Waterfalls, Mandovi River, Goa-Karnataka Border',
    city: 'Sanguem',
    state: 'Goa',
    latitude: 15.3144,
    longitude: 74.3143,
  },
  {
    name: 'Margao (Madgaon)',
    displayName: 'Margao, South Goa, Goa, India',
    city: 'Margao',
    state: 'Goa',
    latitude: 15.2832,
    longitude: 73.9862,
  },

  // Maharashtra
  {
    name: 'Mumbai',
    displayName: 'Mumbai, Mumbai City, Maharashtra, India',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.0760,
    longitude: 72.8777,
  },
  {
    name: 'Gateway of India',
    displayName: 'Gateway of India, Colaba, Mumbai, Maharashtra, 400001, India',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 18.9219661,
    longitude: 72.8345657,
  },
  {
    name: 'Marine Drive',
    displayName: 'Marine Drive (Queen\'s Necklace), Nariman Point, Mumbai, Maharashtra',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 18.9432,
    longitude: 72.8231,
  },
  {
    name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT)',
    displayName: 'CSMT Railway Terminus, Fort, Mumbai, Maharashtra',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 18.9401,
    longitude: 72.8354,
  },
  {
    name: 'Pune',
    displayName: 'Pune, Pune District, Maharashtra, India',
    city: 'Pune',
    state: 'Maharashtra',
    latitude: 18.5204,
    longitude: 73.8567,
  },
  {
    name: 'Shaniwar Wada',
    displayName: 'Shaniwar Wada Palace, Bajirao Rd, Shaniwar Peth, Pune, Maharashtra',
    city: 'Pune',
    state: 'Maharashtra',
    latitude: 18.5196,
    longitude: 73.8553,
  },
  {
    name: 'Lonavala',
    displayName: 'Lonavala Hill Station, Pune District, Maharashtra, India',
    city: 'Lonavala',
    state: 'Maharashtra',
    latitude: 18.7557,
    longitude: 73.4091,
  },
  {
    name: 'Mahabaleshwar',
    displayName: 'Mahabaleshwar, Satara District, Western Ghats, Maharashtra',
    city: 'Mahabaleshwar',
    state: 'Maharashtra',
    latitude: 17.9237,
    longitude: 73.6586,
  },
  {
    name: 'Kolhapur',
    displayName: 'Mahalaxmi Temple, Kolhapur, Maharashtra, India',
    city: 'Kolhapur',
    state: 'Maharashtra',
    latitude: 16.7050,
    longitude: 74.2433,
  },

  // Gujarat
  {
    name: 'Ahmedabad',
    displayName: 'Ahmedabad, Ahmedabad District, Gujarat, India',
    city: 'Ahmedabad',
    state: 'Gujarat',
    latitude: 23.0225,
    longitude: 72.5714,
  },
  {
    name: 'Sabarmati Ashram',
    displayName: 'Sabarmati Ashram (Gandhi Smarak), Ashram Rd, Ahmedabad, Gujarat',
    city: 'Ahmedabad',
    state: 'Gujarat',
    latitude: 23.0605,
    longitude: 72.5800,
  },
  {
    name: 'Statue of Unity',
    displayName: 'Statue of Unity, Sardar Sarovar Dam, Kevadia, Narmada, Gujarat',
    city: 'Kevadia',
    state: 'Gujarat',
    latitude: 21.8380,
    longitude: 73.7191,
  },
  {
    name: 'Surat',
    displayName: 'Surat, Surat District, Gujarat, India',
    city: 'Surat',
    state: 'Gujarat',
    latitude: 21.1702,
    longitude: 72.8311,
  },
  {
    name: 'Vadodara (Baroda)',
    displayName: 'Laxmi Vilas Palace, Vadodara, Gujarat, India',
    city: 'Vadodara',
    state: 'Gujarat',
    latitude: 22.3072,
    longitude: 73.1812,
  },
  {
    name: 'Somnath Temple',
    displayName: 'Somnath Jyotirlinga Temple, Prabhas Patan, Veraval, Gujarat',
    city: 'Somnath',
    state: 'Gujarat',
    latitude: 20.8880,
    longitude: 70.4013,
  },
  {
    name: 'Dwarkadhish Temple',
    displayName: 'Dwarkadhish Temple, Dwarka, Devbhumi Dwarka, Gujarat',
    city: 'Dwarka',
    state: 'Gujarat',
    latitude: 22.2376,
    longitude: 68.9678,
  },

  // North India (Delhi, UP, Rajasthan, Punjab, HP, J&K)
  {
    name: 'New Delhi',
    displayName: 'New Delhi, Delhi NCR, India',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.6139,
    longitude: 77.2090,
  },
  {
    name: 'India Gate',
    displayName: 'India Gate, Rajpath, New Delhi, Delhi, 110001, India',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.612912,
    longitude: 77.2295097,
  },
  {
    name: 'Red Fort',
    displayName: 'Red Fort (Lal Qila), Netaji Subhash Marg, Chandni Chowk, Old Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.6562,
    longitude: 77.2410,
  },
  {
    name: 'Qutub Minar',
    displayName: 'Qutub Minar Complex, Mehrauli, New Delhi, Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.5245,
    longitude: 77.1855,
  },
  {
    name: 'Taj Mahal',
    displayName: 'Taj Mahal, Taj East Gate Rd, Taj Ganj, Agra, Uttar Pradesh',
    city: 'Agra',
    state: 'Uttar Pradesh',
    latitude: 27.1750075,
    longitude: 78.0421013,
  },
  {
    name: 'Agra',
    displayName: 'Agra, Agra District, Uttar Pradesh, India',
    city: 'Agra',
    state: 'Uttar Pradesh',
    latitude: 27.1767,
    longitude: 78.0081,
  },
  {
    name: 'Varanasi',
    displayName: 'Varanasi (Kashi / Banaras), Uttar Pradesh, India',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    latitude: 25.3176,
    longitude: 82.9739,
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
    name: 'Ayodhya',
    displayName: 'Shri Ram Janmabhoomi Mandir, Ayodhya, Uttar Pradesh, India',
    city: 'Ayodhya',
    state: 'Uttar Pradesh',
    latitude: 26.7922,
    longitude: 82.1998,
  },
  {
    name: 'Jaipur',
    displayName: 'Jaipur (Pink City), Jaipur District, Rajasthan, India',
    city: 'Jaipur',
    state: 'Rajasthan',
    latitude: 26.9124,
    longitude: 75.7873,
  },
  {
    name: 'Hawa Mahal',
    displayName: 'Hawa Mahal, Badi Choupad, Jaipur, Rajasthan, 302002',
    city: 'Jaipur',
    state: 'Rajasthan',
    latitude: 26.923932,
    longitude: 75.8268652,
  },
  {
    name: 'Amber Fort',
    displayName: 'Amber Palace & Fort, Devisinghpura, Amer, Jaipur, Rajasthan',
    city: 'Jaipur',
    state: 'Rajasthan',
    latitude: 26.9855,
    longitude: 75.8513,
  },
  {
    name: 'Udaipur',
    displayName: 'City Palace & Lake Pichola, Udaipur, Rajasthan, India',
    city: 'Udaipur',
    state: 'Rajasthan',
    latitude: 24.5854,
    longitude: 73.7125,
  },
  {
    name: 'Jodhpur',
    displayName: 'Mehrangarh Fort, Jodhpur, Rajasthan, India',
    city: 'Jodhpur',
    state: 'Rajasthan',
    latitude: 26.2389,
    longitude: 73.0243,
  },
  {
    name: 'Golden Temple',
    displayName: 'Golden Temple (Harmandir Sahib), Amritsar, Punjab, 143006',
    city: 'Amritsar',
    state: 'Punjab',
    latitude: 31.6200,
    longitude: 74.8765,
  },
  {
    name: 'Manali',
    displayName: 'Mall Road & Solang Valley, Manali, Kullu, Himachal Pradesh',
    city: 'Manali',
    state: 'Himachal Pradesh',
    latitude: 32.2432,
    longitude: 77.1892,
  },
  {
    name: 'Shimla',
    displayName: 'The Ridge & Mall Road, Shimla, Himachal Pradesh, India',
    city: 'Shimla',
    state: 'Himachal Pradesh',
    latitude: 31.1048,
    longitude: 77.1734,
  },
  {
    name: 'Rishikesh',
    displayName: 'Ram Jhula & Laxman Jhula, Rishikesh, Dehradun, Uttarakhand',
    city: 'Rishikesh',
    state: 'Uttarakhand',
    latitude: 30.0869,
    longitude: 78.2676,
  },
  {
    name: 'Srinagar',
    displayName: 'Dal Lake & Mughal Gardens, Srinagar, Jammu and Kashmir',
    city: 'Srinagar',
    state: 'Jammu and Kashmir',
    latitude: 34.0837,
    longitude: 74.7973,
  },

  // South & Eastern India
  {
    name: 'Hyderabad',
    displayName: 'Hyderabad (Charminar & Hitec City), Telangana, India',
    city: 'Hyderabad',
    state: 'Telangana',
    latitude: 17.3850,
    longitude: 78.4867,
  },
  {
    name: 'Charminar',
    displayName: 'Charminar, Old City, Hyderabad, Telangana, 500002, India',
    city: 'Hyderabad',
    state: 'Telangana',
    latitude: 17.3616,
    longitude: 78.4747,
  },
  {
    name: 'Chennai',
    displayName: 'Marina Beach & Central, Chennai, Tamil Nadu, India',
    city: 'Chennai',
    state: 'Tamil Nadu',
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    name: 'Kochi (Cochin)',
    displayName: 'Fort Kochi & Marine Drive, Ernakulam, Kerala, India',
    city: 'Kochi',
    state: 'Kerala',
    latitude: 9.9312,
    longitude: 76.2673,
  },
  {
    name: 'Munnar',
    displayName: 'Tea Gardens & Anamudi, Munnar, Idukki District, Kerala',
    city: 'Munnar',
    state: 'Kerala',
    latitude: 10.0889,
    longitude: 77.0595,
  },
  {
    name: 'Alleppey (Alappuzha)',
    displayName: 'Backwaters & Houseboats, Alappuzha (Alleppey), Kerala, India',
    city: 'Alappuzha',
    state: 'Kerala',
    latitude: 9.4981,
    longitude: 76.3388,
  },
  {
    name: 'Kolkata',
    displayName: 'Victoria Memorial & Howrah Bridge, Kolkata, West Bengal',
    city: 'Kolkata',
    state: 'West Bengal',
    latitude: 22.5726,
    longitude: 88.3639,
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

    // 1. Instant local matching for common destinations (0ms latency)
    const localMatches = POPULAR_INDIAN_DESTINATIONS.filter((item) => {
      const haystack = `${item.name} ${item.displayName} ${item.city} ${item.state}`.toLowerCase();
      return haystack.includes(q);
    });

    // 2. Query backend geocoding endpoint (backed by OpenStreetMap Nominatim with full address details)
    try {
      const res = await apiClient.get('/locations/search', {
        params: { q: query.trim(), limit: 6 },
        timeout: 4500,
      });

      if (res?.data?.success && Array.isArray(res.data.suggestions) && res.data.suggestions.length > 0) {
        // Merge server suggestions with local matches, avoiding duplicates
        const seen = new Set();
        const merged = [];

        for (const item of [...res.data.suggestions, ...localMatches]) {
          const key = (item.name || item.displayName || '').toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        }
        return merged.slice(0, 6);
      }
    } catch (_) {
      // Backend unavailable, fallback directly to public OpenStreetMap Nominatim
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=6&addressdetails=1&countrycodes=in`;
        const directRes = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'RakshaSetuSafetyApp/1.0',
            'Accept-Language': 'en-IN,en;q=0.9',
          },
        });
        const json = await directRes.json();

        if (Array.isArray(json) && json.length > 0) {
          const directItems = json.map((it) => {
            const rawName = it.name || (it.display_name ? it.display_name.split(',')[0].trim() : query.trim());
            const addr = it.address || {};
            const locality = addr.suburb || addr.neighbourhood || addr.road || '';
            const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || '';
            const state = addr.state || '';
            const country = addr.country || 'India';
            const parts = [rawName, locality, city, state, country].filter(Boolean);
            const uniqueParts = [...new Set(parts)];
            const displayName = uniqueParts.join(', ');

            return {
              name: rawName,
              displayName,
              city: city || locality || state,
              state,
              latitude: parseFloat(it.lat),
              longitude: parseFloat(it.lon),
            };
          });

          if (directItems.length > 0) {
            const seen = new Set();
            const merged = [];
            for (const item of [...directItems, ...localMatches]) {
              const key = (item.name || item.displayName || '').toLowerCase().trim();
              if (!seen.has(key)) {
                seen.add(key);
                merged.push(item);
              }
            }
            return merged.slice(0, 6);
          }
        }
      } catch (err) {
        console.warn('Direct Nominatim geocoding warning:', err.message);
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
    } catch (_) { }

    return fallbackCoords;
  }
}

export default new GeocodingService();
