/**
 * Distance & Route Calculation Service for RakshaSetu AI Tourist Assistant
 * Calculates straight-line and realistic driving distance, driving time, train, bus, and flight options,
 * with recommended highway routes, tolls, and safety advice across India and worldwide.
 */

// 120+ Indian and International Cities & Hotspots with High-Precision Coordinates
const CITY_COORDINATES = {
  // Karnataka Hubs
  'belagavi': { name: 'Belagavi', state: 'Karnataka', lat: 15.8497, lng: 74.4977 },
  'belgaum': { name: 'Belagavi', state: 'Karnataka', lat: 15.8497, lng: 74.4977 },
  'udyambag': { name: 'Udyambag (Belagavi)', state: 'Karnataka', lat: 15.8150, lng: 74.4912 },
  'gokak': { name: 'Gokak', state: 'Karnataka', lat: 16.1667, lng: 74.8333 },
  'gokak falls': { name: 'Gokak Falls', state: 'Karnataka', lat: 16.1824, lng: 74.7963 },
  'bengaluru': { name: 'Bengaluru (Bangalore)', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  'bangalore': { name: 'Bengaluru (Bangalore)', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  'mysuru': { name: 'Mysuru (Mysore)', state: 'Karnataka', lat: 12.2958, lng: 76.6394 },
  'mysore': { name: 'Mysuru (Mysore)', state: 'Karnataka', lat: 12.2958, lng: 76.6394 },
  'hubballi': { name: 'Hubballi (Hubli)', state: 'Karnataka', lat: 15.3647, lng: 75.1240 },
  'hubli': { name: 'Hubballi (Hubli)', state: 'Karnataka', lat: 15.3647, lng: 75.1240 },
  'dharwad': { name: 'Dharwad', state: 'Karnataka', lat: 15.4589, lng: 75.0078 },
  'hampi': { name: 'Hampi', state: 'Karnataka', lat: 15.3350, lng: 76.4600 },
  'badami': { name: 'Badami', state: 'Karnataka', lat: 15.9185, lng: 75.6766 },
  'pattadakal': { name: 'Pattadakal', state: 'Karnataka', lat: 15.9485, lng: 75.8166 },
  'aihole': { name: 'Aihole', state: 'Karnataka', lat: 16.0210, lng: 75.8824 },
  'gokarna': { name: 'Gokarna', state: 'Karnataka', lat: 14.5479, lng: 74.3188 },
  'karwar': { name: 'Karwar', state: 'Karnataka', lat: 14.8136, lng: 74.1297 },
  'dandeli': { name: 'Dandeli', state: 'Karnataka', lat: 15.2361, lng: 74.6189 },
  'coorg': { name: 'Coorg (Madikeri)', state: 'Karnataka', lat: 12.4244, lng: 75.7382 },
  'madikeri': { name: 'Coorg (Madikeri)', state: 'Karnataka', lat: 12.4244, lng: 75.7382 },
  'chikmagalur': { name: 'Chikmagalur', state: 'Karnataka', lat: 13.3153, lng: 75.7754 },
  'chikkamagaluru': { name: 'Chikmagalur', state: 'Karnataka', lat: 13.3153, lng: 75.7754 },
  'mangaluru': { name: 'Mangaluru (Mangalore)', state: 'Karnataka', lat: 12.9141, lng: 74.8560 },
  'mangalore': { name: 'Mangaluru (Mangalore)', state: 'Karnataka', lat: 12.9141, lng: 74.8560 },
  'udupi': { name: 'Udupi', state: 'Karnataka', lat: 13.3409, lng: 74.7421 },
  'murudeshwar': { name: 'Murudeshwar', state: 'Karnataka', lat: 14.0940, lng: 74.4899 },
  'shivamogga': { name: 'Shivamogga (Shimoga)', state: 'Karnataka', lat: 13.9299, lng: 75.5681 },
  'shimoga': { name: 'Shivamogga (Shimoga)', state: 'Karnataka', lat: 13.9299, lng: 75.5681 },
  'jog falls': { name: 'Jog Falls', state: 'Karnataka', lat: 14.2285, lng: 74.8124 },
  'vijayapura': { name: 'Vijayapura (Bijapur)', state: 'Karnataka', lat: 16.8302, lng: 75.7100 },
  'bijapur': { name: 'Vijayapura (Bijapur)', state: 'Karnataka', lat: 16.8302, lng: 75.7100 },
  'ballari': { name: 'Ballari (Bellary)', state: 'Karnataka', lat: 15.1394, lng: 76.9214 },
  'bellary': { name: 'Ballari (Bellary)', state: 'Karnataka', lat: 15.1394, lng: 76.9214 },

  // Goa Hubs
  'goa': { name: 'Goa (Panaji)', state: 'Goa', lat: 15.4909, lng: 73.8278 },
  'panaji': { name: 'Panaji', state: 'Goa', lat: 15.4909, lng: 73.8278 },
  'panjim': { name: 'Panaji', state: 'Goa', lat: 15.4909, lng: 73.8278 },
  'north goa': { name: 'North Goa (Calangute)', state: 'Goa', lat: 15.5439, lng: 73.7554 },
  'south goa': { name: 'South Goa (Margao)', state: 'Goa', lat: 15.2736, lng: 73.9582 },
  'margao': { name: 'Margao (Madgaon)', state: 'Goa', lat: 15.2736, lng: 73.9582 },
  'madgaon': { name: 'Margao (Madgaon)', state: 'Goa', lat: 15.2736, lng: 73.9582 },
  'calangute': { name: 'Calangute Beach', state: 'Goa', lat: 15.5439, lng: 73.7554 },
  'baga': { name: 'Baga Beach', state: 'Goa', lat: 15.5553, lng: 73.7517 },
  'anjuna': { name: 'Anjuna Beach', state: 'Goa', lat: 15.5800, lng: 73.7438 },
  'palolem': { name: 'Palolem Beach', state: 'Goa', lat: 15.0100, lng: 74.0232 },
  'dudhsagar': { name: 'Dudhsagar Falls', state: 'Goa', lat: 15.3144, lng: 74.3144 },

  // Maharashtra Hubs
  'mumbai': { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  'bombay': { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  'pune': { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  'kolhapur': { name: 'Kolhapur', state: 'Maharashtra', lat: 16.7050, lng: 74.2433 },
  'solapur': { name: 'Solapur', state: 'Maharashtra', lat: 17.6599, lng: 75.9064 },
  'shirdi': { name: 'Shirdi', state: 'Maharashtra', lat: 19.7667, lng: 74.4767 },
  'nashik': { name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898 },
  'nagpur': { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
  'aurangabad': { name: 'Chhatrapati Sambhajinagar (Aurangabad)', state: 'Maharashtra', lat: 19.8762, lng: 75.3433 },
  'sambhajinagar': { name: 'Chhatrapati Sambhajinagar (Aurangabad)', state: 'Maharashtra', lat: 19.8762, lng: 75.3433 },
  'lonavala': { name: 'Lonavala', state: 'Maharashtra', lat: 18.7557, lng: 73.4091 },
  'mahabaleshwar': { name: 'Mahabaleshwar', state: 'Maharashtra', lat: 17.9237, lng: 73.6586 },
  'alibaug': { name: 'Alibaug', state: 'Maharashtra', lat: 18.6414, lng: 72.8722 },

  // Major Indian Metros & Capitals
  'delhi': { name: 'New Delhi', state: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  'new delhi': { name: 'New Delhi', state: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  'hyderabad': { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
  'chennai': { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  'madras': { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  'kolkata': { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  'calcutta': { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  'ahmedabad': { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  'surat': { name: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311 },
  'vadodara': { name: 'Vadodara (Baroda)', state: 'Gujarat', lat: 22.3072, lng: 73.1812 },
  'jaipur': { name: 'Jaipur (Pink City)', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  'udaipur': { name: 'Udaipur (City of Lakes)', state: 'Rajasthan', lat: 24.5854, lng: 73.7125 },
  'jodhpur': { name: 'Jodhpur (Blue City)', state: 'Rajasthan', lat: 26.2389, lng: 73.0243 },
  'jaisalmer': { name: 'Jaisalmer', state: 'Rajasthan', lat: 26.9157, lng: 70.9083 },
  'agra': { name: 'Agra (Taj Mahal)', state: 'Uttar Pradesh', lat: 27.1767, lng: 78.0081 },
  'lucknow': { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  'varanasi': { name: 'Varanasi (Kashi)', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
  'kashi': { name: 'Varanasi (Kashi)', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
  'ayodhya': { name: 'Ayodhya', state: 'Uttar Pradesh', lat: 26.7922, lng: 82.1998 },
  'chandigarh': { name: 'Chandigarh', state: 'Punjab/Haryana', lat: 30.7333, lng: 76.7794 },
  'amritsar': { name: 'Amritsar (Golden Temple)', state: 'Punjab', lat: 31.6340, lng: 74.8723 },
  'indore': { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
  'bhopal': { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
  'patna': { name: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
  'bhubaneswar': { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lng: 85.8245 },
  'puri': { name: 'Puri (Jagannath Temple)', state: 'Odisha', lat: 19.8135, lng: 85.8312 },
  'ranchi': { name: 'Ranchi', state: 'Jharkhand', lat: 23.3441, lng: 85.3096 },
  'raipur': { name: 'Raipur', state: 'Chhattisgarh', lat: 21.2514, lng: 81.6296 },

  // Kerala & South India
  'kochi': { name: 'Kochi (Cochin)', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  'cochin': { name: 'Kochi (Cochin)', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  'thiruvananthapuram': { name: 'Thiruvananthapuram (Trivandrum)', state: 'Kerala', lat: 8.5241, lng: 76.9366 },
  'trivandrum': { name: 'Thiruvananthapuram (Trivandrum)', state: 'Kerala', lat: 8.5241, lng: 76.9366 },
  'munnar': { name: 'Munnar', state: 'Kerala', lat: 10.0889, lng: 77.0595 },
  'alleppey': { name: 'Alleppey (Alappuzha)', state: 'Kerala', lat: 9.4981, lng: 76.3388 },
  'alappuzha': { name: 'Alleppey (Alappuzha)', state: 'Kerala', lat: 9.4981, lng: 76.3388 },
  'wayanad': { name: 'Wayanad', state: 'Kerala', lat: 11.6854, lng: 76.1320 },
  'kerala': { name: 'Kerala (Kochi/Munnar)', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  'ooty': { name: 'Ooty (Udhagamandalam)', state: 'Tamil Nadu', lat: 11.4102, lng: 76.6950 },
  'kodaikanal': { name: 'Kodaikanal', state: 'Tamil Nadu', lat: 10.2381, lng: 77.4892 },
  'pondicherry': { name: 'Pondicherry (Puducherry)', state: 'Puducherry', lat: 11.9416, lng: 79.8083 },
  'puducherry': { name: 'Pondicherry (Puducherry)', state: 'Puducherry', lat: 11.9416, lng: 79.8083 },
  'rameshwaram': { name: 'Rameshwaram', state: 'Tamil Nadu', lat: 9.2876, lng: 79.3129 },
  'kanyakumari': { name: 'Kanyakumari', state: 'Tamil Nadu', lat: 8.0883, lng: 77.5385 },
  'tirupati': { name: 'Tirupati (Balaji)', state: 'Andhra Pradesh', lat: 13.6288, lng: 79.4192 },
  'visakhapatnam': { name: 'Visakhapatnam (Vizag)', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
  'vizag': { name: 'Visakhapatnam (Vizag)', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },

  // North & Himalayas
  'manali': { name: 'Manali', state: 'Himachal Pradesh', lat: 32.2432, lng: 77.1892 },
  'shimla': { name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734 },
  'dharamshala': { name: 'Dharamshala (McLeod Ganj)', state: 'Himachal Pradesh', lat: 32.2190, lng: 76.3234 },
  'rishikesh': { name: 'Rishikesh', state: 'Uttarakhand', lat: 30.0869, lng: 78.2676 },
  'haridwar': { name: 'Haridwar', state: 'Uttarakhand', lat: 29.9457, lng: 78.1642 },
  'dehradun': { name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lng: 78.0322 },
  'nainital': { name: 'Nainital', state: 'Uttarakhand', lat: 29.3919, lng: 79.4542 },
  'srinagar': { name: 'Srinagar (Dal Lake)', state: 'Jammu & Kashmir', lat: 34.0837, lng: 74.7973 },
  'leh': { name: 'Leh (Ladakh)', state: 'Ladakh', lat: 34.1526, lng: 77.5771 },
  'ladakh': { name: 'Leh (Ladakh)', state: 'Ladakh', lat: 34.1526, lng: 77.5771 },
  'gulmarg': { name: 'Gulmarg', state: 'Jammu & Kashmir', lat: 34.0484, lng: 74.3805 },

  // East & North East
  'darjeeling': { name: 'Darjeeling', state: 'West Bengal', lat: 27.0410, lng: 88.2663 },
  'gangtok': { name: 'Gangtok', state: 'Sikkim', lat: 27.3389, lng: 88.6065 },
  'guwahati': { name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362 },
  'shillong': { name: 'Shillong', state: 'Meghalaya', lat: 25.5788, lng: 91.8933 },

  // International
  'dubai': { name: 'Dubai', state: 'UAE', lat: 25.2048, lng: 55.2708 },
  'singapore': { name: 'Singapore', state: 'Singapore', lat: 1.3521, lng: 103.8198 },
  'bangkok': { name: 'Bangkok', state: 'Thailand', lat: 13.7563, lng: 100.5018 },
  'london': { name: 'London', state: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  'paris': { name: 'Paris', state: 'France', lat: 48.8566, lng: 2.3522 },
  'new york': { name: 'New York City', state: 'USA', lat: 40.7128, lng: -74.0060 },
  'tokyo': { name: 'Tokyo', state: 'Japan', lat: 35.6762, lng: 139.6503 },
  'rome': { name: 'Rome', state: 'Italy', lat: 41.9028, lng: 12.4964 },
  'bali': { name: 'Bali', state: 'Indonesia', lat: -8.3405, lng: 115.0920 },
};

// Major Highways and Corridors for realistic routes
const HIGHWAY_ROUTES = [
  { p1: 'belagavi', p2: 'goa', highway: 'NH-748 (via Chorla Ghat) or NH-4A (via Anmod Ghat)', notes: 'Scenic Western Ghats mountain pass. Recommended daytime travel due to fog and winding curves.' },
  { p1: 'belagavi', p2: 'bengaluru', highway: 'NH-48 (Asian Highway 47 / Golden Quadrilateral)', notes: 'High-speed 4/6-lane expressway via Hubballi, Davanagere, and Tumakuru.' },
  { p1: 'belagavi', p2: 'pune', highway: 'NH-48 (via Kolhapur & Satara)', notes: 'Smooth 6-lane national highway. Excellent food stops near Kolhapur and Satara.' },
  { p1: 'belagavi', p2: 'mumbai', highway: 'NH-48 + Mumbai-Pune Expressway', notes: 'Major arterial corridor. Quick transit once entering the expressway at Pune.' },
  { p1: 'belagavi', p2: 'hubballi', highway: 'NH-48', notes: 'Divided 4-lane highway with heavy industrial traffic.' },
  { p1: 'belagavi', p2: 'kolhapur', highway: 'NH-48', notes: 'Direct high-speed corridor with toll plazas at Kognoli.' },
  { p1: 'belagavi', p2: 'gokak', highway: 'SH-31 (Belagavi-Bagalkote Road)', notes: 'Well-paved state highway passing through scenic agricultural belts.' },
  { p1: 'belagavi', p2: 'gokak falls', highway: 'SH-31 via Gokak Town', notes: 'Picturesque countryside drive.' },
  { p1: 'belagavi', p2: 'hampi', highway: 'NH-48 to Hubballi -> NH-67 via Gadag & Hospet', notes: 'Historic heritage route. Hospet bypass offers smooth entry to UNESCO ruins.' },
  { p1: 'belagavi', p2: 'badami', highway: 'SH via Ramdurg & Bagalkote', notes: 'Historic temple route passing Chalukyan monuments.' },
  { p1: 'mumbai', p2: 'pune', highway: 'Mumbai-Pune Expressway (Yashwantrao Chavan Expressway)', notes: 'Access-controlled 6-lane toll expressway through the Khandala ghats.' },
  { p1: 'bengaluru', p2: 'mysuru', highway: 'Bengaluru-Mysuru Expressway (NH-275)', notes: '10-lane access-controlled greenfield expressway, cutting travel to just 90-120 mins.' },
  { p1: 'delhi', p2: 'jaipur', highway: 'Delhi-Mumbai Expressway (NE-4) or NH-48', notes: 'State-of-the-art expressway reducing transit to ~3.5 hours.' },
  { p1: 'delhi', p2: 'agra', highway: 'Yamuna Expressway', notes: '6-lane access-controlled concrete highway connecting Greater Noida to Agra.' },
  { p1: 'mumbai', p2: 'goa', highway: 'NH-66 (Coastal Highway) or NH-48 via Pune/Kolhapur', notes: 'NH-48 via Kolhapur is faster; NH-66 offers panoramic Konkan coastal views.' },
];

/**
 * Calculate Great-Circle distance using Haversine formula (km)
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find coordinates for a city or landmark name from dictionary
 */
function resolvePlace(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.toLowerCase().trim().replace(/^(the|city\s+of|town\s+of)\s+/i, '');

  // Exact match
  if (CITY_COORDINATES[clean]) {
    return CITY_COORDINATES[clean];
  }

  // Substring or alias match
  const keys = Object.keys(CITY_COORDINATES);
  for (const k of keys) {
    if (clean === k || clean.includes(k) || k.includes(clean)) {
      return CITY_COORDINATES[k];
    }
  }

  return null;
}

/**
 * Format hours into readable format (e.g., "3 hrs 30 mins")
 */
function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hrs`;
  return `${h} hrs ${m} mins`;
}

/**
 * Detect if user query is asking for distance and extract source & destination
 */
function parseDistanceQuery(query = '', context = {}) {
  const q = String(query || '').toLowerCase().trim();

  // Keyword check
  const isDistanceQuestion =
    q.includes('distance') ||
    q.includes('how far') ||
    q.includes('how many km') ||
    q.includes('how many kilometer') ||
    q.includes('how many kms') ||
    q.includes('how much time to reach') ||
    q.includes('travel time between') ||
    q.includes('driving time') ||
    q.includes('route between') ||
    q.includes('route from') ||
    q.includes('reach from') ||
    q.includes('km between') ||
    q.includes('kms between');

  if (!isDistanceQuestion) return null;

  // Patterns to extract places:
  // "distance between X and Y"
  // "how far is X from Y"
  // "distance from X to Y"
  // "how far from X to Y"
  // "distance X to Y"
  let place1Name = null;
  let place2Name = null;

  const betweenMatch = q.match(/(?:distance|time|km|kms|route)\s+(?:is\s+)?between\s+([a-z\s]+?)\s+(?:and|to|&)\s+([a-z\s\?\.]+)/i);
  const fromToMatch = q.match(/(?:distance|time|how\s+far|route|reach)\s+(?:is\s+)?from\s+([a-z\s]+?)\s+to\s+([a-z\s\?\.]+)/i);
  const howFarFromMatch = q.match(/how\s+far\s+(?:is\s+)?([a-z\s]+?)\s+from\s+([a-z\s\?\.]+)/i);
  const directToMatch = q.match(/distance\s+(?:to\s+)?([a-z\s]+?)\s+(?:to\s+)?([a-z\s\?\.]+)/i);

  if (betweenMatch) {
    place1Name = betweenMatch[1].trim();
    place2Name = betweenMatch[2].replace(/[\?\.]/g, '').trim();
  } else if (fromToMatch) {
    place1Name = fromToMatch[1].trim();
    place2Name = fromToMatch[2].replace(/[\?\.]/g, '').trim();
  } else if (howFarFromMatch) {
    place2Name = howFarFromMatch[1].trim();
    place1Name = howFarFromMatch[2].replace(/[\?\.]/g, '').trim();
  }

  // If user asked "how far is Gokak Falls" (single place relative to current location)
  if (!place1Name && !place2Name) {
    const singleFarMatch = q.match(/how\s+far\s+is\s+([a-z\s]+)/i) || q.match(/distance\s+(?:to\s+)?([a-z\s]+)/i);
    if (singleFarMatch) {
      place2Name = singleFarMatch[1].replace(/(from\s+here|from\s+me|from\s+my\s+location|from\s+current\s+location|\?)/gi, '').trim();
      place1Name = 'current location';
    }
  }

  // Check if "here" or "my location" or "current location" is used
  const isHere = (name) => /here|me|my\s*location|current\s*location|present\s*location/i.test(name || '');

  let p1Obj = null;
  let p2Obj = null;

  if (isHere(place1Name)) {
    const lat = context.coords?.latitude || 15.8497;
    const lng = context.coords?.longitude || 74.4977;
    p1Obj = { name: 'Your Current Location (Belagavi Region)', lat, lng };
  } else if (place1Name) {
    p1Obj = resolvePlace(place1Name);
  }

  if (isHere(place2Name)) {
    const lat = context.coords?.latitude || 15.8497;
    const lng = context.coords?.longitude || 74.4977;
    p2Obj = { name: 'Your Current Location (Belagavi Region)', lat, lng };
  } else if (place2Name) {
    p2Obj = resolvePlace(place2Name);
  }

  // If only one place recognized and the other wasn't parsed, default source to current location
  if (!p1Obj && p2Obj) {
    const lat = context.coords?.latitude || 15.8497;
    const lng = context.coords?.longitude || 74.4977;
    p1Obj = { name: 'Your Current Location (Belagavi Region)', lat, lng };
  } else if (p1Obj && !p2Obj) {
    // Attempt to search remaining query text
    const cleanRemainder = q.replace(place1Name || '', '').replace(/distance|between|and|from|to|how|far|is|\?/gi, '').trim();
    p2Obj = resolvePlace(cleanRemainder);
  }

  // Fallback: check if query contains any two known city names
  if (!p1Obj || !p2Obj) {
    const words = q.split(/[\s,\-\/]+/);
    const foundCities = [];
    for (const [k, v] of Object.entries(CITY_COORDINATES)) {
      if (q.includes(k) && !foundCities.some((c) => c.key === k)) {
        foundCities.push({ key: k, ...v });
      }
    }
    if (foundCities.length >= 2) {
      p1Obj = foundCities[0];
      p2Obj = foundCities[1];
    } else if (foundCities.length === 1) {
      const lat = context.coords?.latitude || 15.8497;
      const lng = context.coords?.longitude || 74.4977;
      p1Obj = { name: 'Your Current Location (Belagavi Region)', lat, lng };
      p2Obj = foundCities[0];
    }
  }

  if (!p1Obj || !p2Obj) return null;

  return {
    origin: p1Obj,
    destination: p2Obj,
  };
}

/**
 * Generate comprehensive distance, travel time, and route response
 */
function calculateDistanceReport(origin, destination) {
  const straightKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);

  // Real road multiplier (Indian highways average ~1.22x - 1.35x of straight line due to terrain/bypasses)
  const isMountainous = /goa|dudhsagar|gokak|coorg|chikmagalur|ooty|munnar|manali|shimla|rishikesh|darjeeling|leh/i.test(
    `${origin.name} ${destination.name}`
  );
  const roadMultiplier = isMountainous ? 1.35 : 1.25;
  const roadKm = Math.round(straightKm * roadMultiplier);

  // Travel modes
  // Driving by Car / Taxi: Average 60-75 km/h on Indian NH / 40 km/h in ghats
  const avgCarSpeed = isMountainous ? 45 : 68;
  const drivingHours = (roadKm / avgCarSpeed) + (roadKm > 200 ? 0.5 : 0); // add tea/pitstop
  const drivingDuration = formatDuration(drivingHours);

  // Bus: Average 45 km/h
  const busHours = (roadKm / 42) + (roadKm > 150 ? 1 : 0.25);
  const busDuration = formatDuration(busHours);

  // Train estimate (if distance > 60 km)
  let trainInfo = null;
  if (roadKm >= 50) {
    const trainHours = (roadKm / 60) + 0.5;
    trainInfo = `${formatDuration(trainHours)} (Direct Express / Superfast trains available on this sector)`;
  }

  // Flight estimate (if distance > 320 km)
  let flightInfo = null;
  if (straightKm >= 320) {
    const flightHours = Math.max(1, (straightKm / 650));
    flightInfo = `${formatDuration(flightHours)} (Direct / 1-stop commercial flights connecting nearest airports)`;
  }

  // Highway Route Matching
  const k1 = origin.name.toLowerCase();
  const k2 = destination.name.toLowerCase();
  const matchedRoute = HIGHWAY_ROUTES.find(
    (r) => (k1.includes(r.p1) && k2.includes(r.p2)) || (k1.includes(r.p2) && k2.includes(r.p1))
  );

  const highwayName = matchedRoute ? matchedRoute.highway : 'National Highway / State Arterial Corridor (NH)';
  const routeNotes = matchedRoute ? matchedRoute.notes : 'Standard well-paved national highway network with 24/7 emergency toll assistance.';

  let markdown = `### 🗺️ Distance & Route Breakdown: **${origin.name}** ➔ **${destination.name}**\n\n`;
  markdown += `• 📏 **Driving Road Distance:** **~${roadKm} km**\n`;
  markdown += `• 🚗 **Driving Duration (Car/Cab):** **${drivingDuration}**\n`;
  markdown += `• 🚌 **State / AC Bus Travel:** **${busDuration}** (KSRTC / MSRTC / Private Sleeper)\n`;
  markdown += `• ✈️ **Aerial Distance:** ~${Math.round(straightKm)} km\n`;
  if (trainInfo) markdown += `• 🚆 **Train Connectivity:** ${trainInfo}\n`;
  if (flightInfo) markdown += `• 🛫 **Flight Option:** ${flightInfo}\n`;
  markdown += `\n`;

  markdown += `#### 🛣️ Recommended Route & Highway:\n`;
  markdown += `- **Main Corridor:** ${highwayName}\n`;
  markdown += `- **Road Condition & Advice:** ${routeNotes}\n`;
  markdown += `- **Tolls & Rest Stops:** Regular petrol pumps, clean food plazas, and highway patrol stations available.\n\n`;

  markdown += `#### 🛡️ Travel Safety Guidelines:\n`;
  if (isMountainous) {
    markdown += `- ⚠️ **Ghats & Winding Curves:** Drive with headlights on, maintain lower gears on descents, and avoid overtaking on blind curves.\n`;
    markdown += `- 🌧️ **Monsoon Alert:** In heavy rains, be cautious of rock falls or slippery asphalt near ghat sections.\n`;
  } else {
    markdown += `- 🚗 Maintain steady speed limits (80-100 km/h) on national expressways.\n`;
    markdown += `- 📴 Keep fast-tag loaded and ensure offline maps downloaded in RakshaSetu.\n`;
  }
  markdown += `- 🚨 In case of vehicle breakdown or medical emergency on route, dial **112 (National Emergency)** or **1033 (National Highways Helpline)**.\n\n`;

  markdown += `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n`;
  markdown += `[SUGGESTIONS: What are top attractions in ${destination.name}? | Where is the nearest hospital & police? | What are safe travel tips?]`;

  return markdown;
}

module.exports = {
  CITY_COORDINATES,
  parseDistanceQuery,
  calculateDistanceReport,
  haversineKm,
};
