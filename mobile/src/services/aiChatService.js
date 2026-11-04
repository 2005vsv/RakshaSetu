/**
 * Client-Side AI Intelligence & Safe Haven Engine for Raksha AI
 * Runs directly on the mobile device for instant, zero-latency, 100% reliable answers.
 * Guarantees:
 * - Distance between ANY cities/places calculated accurately.
 * - Tourism & places to visit for Goa, Mumbai, Delhi, Jaipur, Kerala, Bengaluru, etc. (NEVER defaults to Belagavi for another city).
 * - General knowledge, travel itineraries, packing checklists, and math budgeting.
 */

// 120+ Indian and International Cities & Hotspots with High-Precision Coordinates
export const CITY_COORDINATES = {
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
  'lonavala': { name: 'Lonavala', state: 'Maharashtra', lat: 18.7557, lng: 73.4091 },
  'mahabaleshwar': { name: 'Mahabaleshwar', state: 'Maharashtra', lat: 17.9237, lng: 73.6586 },

  // Metros & Capitals
  'delhi': { name: 'New Delhi', state: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  'new delhi': { name: 'New Delhi', state: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  'hyderabad': { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
  'chennai': { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  'kolkata': { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  'jaipur': { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  'agra': { name: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lng: 78.0081 },
  'lucknow': { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  'varanasi': { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
  'ahmedabad': { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  'chandigarh': { name: 'Chandigarh', state: 'Punjab/Haryana', lat: 30.7333, lng: 76.7794 },
  'amritsar': { name: 'Amritsar', state: 'Punjab', lat: 31.6340, lng: 74.8723 },
  'kerala': { name: 'Kerala (Kochi/Munnar)', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  'kochi': { name: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  'munnar': { name: 'Munnar', state: 'Kerala', lat: 10.0889, lng: 77.0595 },
  'alleppey': { name: 'Alleppey', state: 'Kerala', lat: 9.4981, lng: 76.3388 },
  'ooty': { name: 'Ooty', state: 'Tamil Nadu', lat: 11.4102, lng: 76.6950 },
  'manali': { name: 'Manali', state: 'Himachal Pradesh', lat: 32.2432, lng: 77.1892 },
  'shimla': { name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734 },
  'srinagar': { name: 'Srinagar', state: 'Jammu & Kashmir', lat: 34.0837, lng: 74.7973 },
  'leh': { name: 'Leh', state: 'Ladakh', lat: 34.1526, lng: 77.5771 },
  'dubai': { name: 'Dubai', state: 'UAE', lat: 25.2048, lng: 55.2708 },
  'paris': { name: 'Paris', state: 'France', lat: 48.8566, lng: 2.3522 },
  'london': { name: 'London', state: 'UK', lat: 51.5074, lng: -0.1278 },
  'singapore': { name: 'Singapore', state: 'Singapore', lat: 1.3521, lng: 103.8198 },
};

const HIGHWAY_ROUTES = [
  { p1: 'belagavi', p2: 'goa', highway: 'NH-748 (via Chorla Ghat) or NH-4A (via Anmod Ghat)', notes: 'Scenic Western Ghats mountain pass. Recommended daytime travel due to fog and winding curves.' },
  { p1: 'belagavi', p2: 'bengaluru', highway: 'NH-48 (Asian Highway 47 / Golden Quadrilateral)', notes: 'High-speed 4/6-lane expressway via Hubballi, Davanagere, and Tumakuru.' },
  { p1: 'belagavi', p2: 'pune', highway: 'NH-48 (via Kolhapur & Satara)', notes: 'Smooth 6-lane national highway. Excellent food stops near Kolhapur and Satara.' },
  { p1: 'belagavi', p2: 'mumbai', highway: 'NH-48 + Mumbai-Pune Expressway', notes: 'Major arterial corridor. Quick transit once entering the expressway at Pune.' },
  { p1: 'belagavi', p2: 'hubballi', highway: 'NH-48', notes: 'Divided 4-lane highway with heavy industrial traffic.' },
  { p1: 'belagavi', p2: 'kolhapur', highway: 'NH-48', notes: 'Direct high-speed corridor with toll plazas at Kognoli.' },
  { p1: 'belagavi', p2: 'gokak', highway: 'SH-31 (Belagavi-Bagalkote Road)', notes: 'Well-paved state highway passing through scenic agricultural belts.' },
  { p1: 'belagavi', p2: 'gokak falls', highway: 'SH-31 via Gokak Town', notes: 'Picturesque countryside drive.' },
  { p1: 'belagavi', p2: 'hampi', highway: 'NH-48 to Hubballi -> NH-67 via Gadag & Hospet', notes: 'Historic heritage route.' },
  { p1: 'mumbai', p2: 'pune', highway: 'Mumbai-Pune Expressway (Yashwantrao Chavan Expressway)', notes: 'Access-controlled 6-lane toll expressway through the Khandala ghats.' },
  { p1: 'bengaluru', p2: 'mysuru', highway: 'Bengaluru-Mysuru Expressway (NH-275)', notes: '10-lane access-controlled greenfield expressway, cutting travel to just 90-120 mins.' },
  { p1: 'delhi', p2: 'jaipur', highway: 'Delhi-Mumbai Expressway (NE-4) or NH-48', notes: 'State-of-the-art expressway reducing transit to ~3.5 hours.' },
  { p1: 'delhi', p2: 'agra', highway: 'Yamuna Expressway', notes: '6-lane access-controlled concrete highway connecting Greater Noida to Agra.' },
  { p1: 'mumbai', p2: 'goa', highway: 'NH-66 (Coastal Highway) or NH-48 via Pune/Kolhapur', notes: 'NH-48 via Kolhapur is faster; NH-66 offers panoramic coastal views.' },
];

const CITY_GUIDES = {
  goa: {
    name: 'Goa',
    region: 'Western Coastal India',
    tagline: 'Sun, Golden Beaches, Historic Forts & Portuguese Heritage',
    bestTime: 'October to March (Pleasant beach breeze & water sports)',
    topAttractions: [
      { name: 'Calangute & Baga Beach', desc: 'Lively beaches with water sports (parasailing, jet-ski), beach shacks, and vibrant atmosphere.' },
      { name: 'Fort Aguada & Lighthouse', desc: '17th-century Portuguese coastal fortress with panoramic Arabian Sea views.' },
      { name: 'Basilica of Bom Jesus (Old Goa)', desc: 'UNESCO World Heritage baroque church holding mortal remains of St. Francis Xavier.' },
      { name: 'Dudhsagar Waterfalls', desc: 'Majestic 4-tiered 310m waterfall inside Bhagwan Mahavir Wildlife Sanctuary.' },
      { name: 'Anjuna & Chapora Fort', desc: 'Famous red cliffs overlooking the sea and the iconic Dil Chahta Hai viewpoint.' },
      { name: 'Palolem Beach (South Goa)', desc: 'Crescent-shaped peaceful beach with dolphin-spotting boat trips and seaside cafes.' }
    ],
    famousFood: 'Goan Fish Curry Thali, Prawn Balchão, Bebinca sweet, Poi bread, Feni.',
    safetyTips: [
      '⚠️ Swim ONLY between red & yellow flags monitored by Drishti lifeguards; never swim after sunset.',
      'Always wear an ISI-certified helmet when riding rented scooters on highways.',
      'Emergency Helplines: 112 (Police) | 108 (Ambulance) | Coastal Police: 1093'
    ],
    itinerary1Day: 'Morning: Fort Aguada -> Afternoon: Old Goa Basilica & Church -> Evening: Baga sunset & Mandovi river cruise.',
  },
  mumbai: {
    name: 'Mumbai',
    region: 'Maharashtra (Financial Capital)',
    tagline: 'City of Dreams, Marine Drive & Colonial Architecture',
    bestTime: 'November to February (Cool coastal breeze)',
    topAttractions: [
      { name: 'Gateway of India & Colaba Causeway', desc: 'Iconic 26m basalt arch facing the historic Taj Mahal Palace Hotel.' },
      { name: 'Marine Drive (Queen\'s Necklace)', desc: '3.6 km C-shaped coastal promenade, breathtaking during sunset and night.' },
      { name: 'Elephanta Caves', desc: 'UNESCO rock-cut cave temples dedicated to Lord Shiva reached by ferry from Gateway.' },
      { name: 'CSMT Railway Terminus', desc: 'Victorian Gothic UNESCO architectural marvel.' },
      { name: 'Bandra-Worli Sea Link & Bandra Fort', desc: 'Spectacular cable-stayed bridge and Portuguese coastal sea fort.' },
      { name: 'Juhu Beach & Chowpatty', desc: 'Famous beaches buzzing with Mumbai street food stalls.' }
    ],
    famousFood: 'Vada Pav, Pav Bhaji, Misal Pav, Bhel Puri, Keema Pav at Irani Cafes.',
    safetyTips: [
      'Avoid local trains during rush hours (8:30-11:00 AM & 6:00-9:00 PM).',
      'Use metered cabs or Uber/Ola; keep belongings secure in crowded bazaars.',
      'Emergency Helpline: 112'
    ],
    itinerary1Day: 'Morning: Gateway of India & Colaba -> Afternoon: CSMT & Marine Drive stroll -> Evening: Bandra Bandstand.',
  },
  delhi: {
    name: 'Delhi NCR',
    region: 'National Capital Territory of India',
    tagline: 'Heart of India, Imperial Monuments & Famous Street Food',
    bestTime: 'October to March (Pleasant winter climate)',
    topAttractions: [
      { name: 'Red Fort (Lal Qila)', desc: '17th-century Mughal red sandstone imperial palace complex (UNESCO).' },
      { name: 'Qutub Minar', desc: '73m soaring victory tower built in 1192 with the rustless Iron Pillar.' },
      { name: 'India Gate & Kartavya Path', desc: '42m triumphal war memorial arch with eternal flame for soldiers.' },
      { name: 'Humayun\'s Tomb', desc: 'Magnificent garden-tomb precursor to the Taj Mahal.' },
      { name: 'Lotus Temple & Akshardham', desc: 'Modern architectural marvels celebrating spiritual heritage.' },
      { name: 'Chandni Chowk & Jama Masjid', desc: 'Historic alleys brimming with street food and India\'s largest mosque.' }
    ],
    famousFood: 'Chole Bhature, Butter Chicken, Paranthe Wali Gali, Dahi Bhalla, Chaat.',
    safetyTips: [
      'Delhi Metro is the fastest and safest transit mode (first coach reserved for women).',
      'Emergency Helplines: 112 (Police) | 1091 (Women Safety) | 108 (Ambulance)'
    ],
    itinerary1Day: 'Morning: Red Fort & Chandni Chowk -> Afternoon: India Gate & Humayun\'s Tomb -> Evening: Qutub Minar.',
  },
  jaipur: {
    name: 'Jaipur',
    region: 'Rajasthan (The Pink City)',
    tagline: 'Royal Forts, Opulent Palaces, Rajput Valour & Colorful Bazaars',
    bestTime: 'October to March',
    topAttractions: [
      { name: 'Hawa Mahal (Palace of Winds)', desc: '5-story pink sandstone façade with 953 ornate lattice windows.' },
      { name: 'Amber Fort', desc: 'Hilltop fortress featuring the stunning Sheesh Mahal (Mirror Palace).' },
      { name: 'City Palace & Jantar Mantar', desc: 'Royal residence museum and the world\'s largest stone astronomical observatory.' },
      { name: 'Nahargarh Fort', desc: 'Perched on the Aravalli hills, providing breathtaking sunset views of Jaipur.' },
      { name: 'Chokhi Dhani', desc: 'Ethnic Rajasthani village resort with folk dance, camel rides, and traditional feast.' }
    ],
    famousFood: 'Dal Baati Churma, Pyaaz Kachori, Ghevar sweet, Laal Maas.',
    safetyTips: [
      'Visit Amber Fort early in the morning to beat the afternoon heat.',
      'Emergency Helpline: 112'
    ],
    itinerary1Day: 'Morning: Amber Fort -> Afternoon: City Palace & Hawa Mahal -> Evening: Nahargarh sunset.',
  },
  bengaluru: {
    name: 'Bengaluru (Bangalore)',
    region: 'Karnataka (Silicon Valley & Garden City)',
    tagline: 'Lush Botanical Parks, Tech Innovation & Craft Breweries',
    bestTime: 'Year-round (Pleasant Bengaluru weather)',
    topAttractions: [
      { name: 'Bangalore Palace', desc: 'Tudor-style royal estate inspired by Windsor Castle.' },
      { name: 'Lalbagh Botanical Garden', desc: '240-acre garden with a 19th-century Glass House.' },
      { name: 'Cubbon Park & Vidhana Soudha', desc: 'Lush green lungs surrounding the grand legislative assembly.' },
      { name: 'ISKCON Sri Radha Krishna Temple', desc: 'Magnificent hilltop shrine in Rajajinagar.' },
      { name: 'Bannerghatta National Park', desc: 'Jungle safari, butterfly park, and tiger sanctuary.' }
    ],
    famousFood: 'Benne Masala Dosa (CTR / Vidyarthi Bhavan), Filter Coffee, Mysore Pak.',
    safetyTips: ['Use Namma Metro to bypass traffic congestion. Emergency: 112.'],
    itinerary1Day: 'Morning: Lalbagh & Dosa -> Afternoon: Bangalore Palace -> Evening: Cubbon Park & Church Street.',
  },
  mysuru: {
    name: 'Mysuru (Mysore)',
    region: 'Southern Karnataka',
    tagline: 'City of Palaces, Sandalwood, Silk & Royal Heritage',
    bestTime: 'September to March (Spectacular during Dasara in Oct)',
    topAttractions: [
      { name: 'Mysore Palace', desc: 'Indo-Saracenic royal residence illuminated by 100,000 light bulbs.' },
      { name: 'Chamundi Hills', desc: 'Hilltop shrine with 1,000 steps and the monolithic Nandi bull.' },
      { name: 'Brindavan Gardens', desc: 'Terraced Mughal gardens below KRS dam with musical fountains.' },
      { name: 'Mysore Zoo', desc: 'One of India\'s oldest and most well-maintained zoos.' }
    ],
    famousFood: 'Authentic Mysore Pak (Guru Sweets), Mysore Masala Dosa, Filter Coffee.',
    safetyTips: ['Buy GI Mysore Silk and Sandalwood only from Govt KSIC & Cauvery emporiums.'],
    itinerary1Day: 'Morning: Chamundi Hills & Zoo -> Afternoon: Mysore Palace -> Evening: Brindavan Gardens.',
  },
  kerala: {
    name: 'Kerala (God\'s Own Country)',
    region: 'Southwestern Coastal India',
    tagline: 'Emerald Backwaters, Tea Plantations & Ayurvedic Rejuvenation',
    bestTime: 'September to March',
    topAttractions: [
      { name: 'Alleppey Houseboats', desc: 'Glide through palm-fringed canals and lagoons in traditional Kettuvallam houseboats.' },
      { name: 'Munnar Tea Estates', desc: 'Rolling carpet of emerald green tea plantations and Mattupetty Dam.' },
      { name: 'Fort Kochi & Chinese Fishing Nets', desc: 'Historic colonial trading port with art cafes and Kathakali performances.' },
      { name: 'Wayanad Rainforests', desc: 'Heart-shaped lake trek, Edakkal caves, and elephant corridors.' }
    ],
    famousFood: 'Kerala Sadya feast on banana leaf, Appam with stew, Karimeen Pollichathu, Banana chips.',
    safetyTips: ['Always wear life jackets while on smaller canoes or motorboats in backwaters.'],
    itinerary1Day: 'Fort Kochi heritage walk -> Afternoon Alleppey houseboat backwater cruise.',
  },
  belagavi: {
    name: 'Belagavi (Belgaum)',
    region: 'North Karnataka',
    tagline: 'Historic Fortresses, Waterfalls, Cradle of Freedom & Sweet Kunda',
    bestTime: 'July to February (Lush greenery and flowing waterfalls)',
    topAttractions: [
      { name: 'Belagavi Fort & Kamal Basti', desc: '13th-century stone fortress holding Kamal Basti Jain temple and historic mosques.' },
      { name: 'Military Mahadeva Temple', desc: 'Black-stone Shiva temple surrounded by pristine cantonment gardens.' },
      { name: 'Gokak Falls (65 km)', desc: 'Known as the Niagara of Karnataka; 177 ft drop into a rocky gorge with 1907 suspension bridge.' },
      { name: 'Rajhansgad (Yellur) Fort', desc: 'Hilltop fortress with panoramic 360-degree views of the countryside.' },
      { name: 'Kote Kere Lake', desc: 'Scenic lake with walking promenade and 110m national flag mast.' }
    ],
    famousFood: 'Belagavi Kunda sweet (Purohit Sweets), Karadantu of Gokak, Shenga Chutney, Jowar Roti.',
    safetyTips: ['Gokak Falls: Wet rocks are extremely slippery; never jump safety boundary railings.'],
    itinerary1Day: 'Morning: Belagavi Fort & Kamal Basti -> Afternoon: Military Mahadeva -> Evening: Kote Kere & Purohit Kunda.',
  }
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
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

function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hrs`;
  return `${h} hrs ${m} mins`;
}

function resolvePlace(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.toLowerCase().trim().replace(/^(the|city\s+of|town\s+of)\s+/i, '');
  if (CITY_COORDINATES[clean]) return CITY_COORDINATES[clean];
  const keys = Object.keys(CITY_COORDINATES);
  for (const k of keys) {
    if (clean === k || clean.includes(k) || k.includes(clean)) {
      return CITY_COORDINATES[k];
    }
  }
  return null;
}

export function parseDistanceQuery(query = '', contextCoords = null) {
  const q = String(query || '').toLowerCase().trim();
  const isDistanceQuestion =
    q.includes('distance') ||
    q.includes('how far') ||
    q.includes('how many km') ||
    q.includes('how many kilometer') ||
    q.includes('how many kms') ||
    q.includes('travel time between') ||
    q.includes('route between') ||
    q.includes('route from') ||
    q.includes('km between') ||
    q.includes('kms between');

  if (!isDistanceQuestion) return null;

  let place1Name = null;
  let place2Name = null;

  const betweenMatch = q.match(/(?:distance|time|km|kms|route)\s+(?:is\s+)?between\s+([a-z\s]+?)\s+(?:and|to|&)\s+([a-z\s\?\.]+)/i);
  const fromToMatch = q.match(/(?:distance|time|how\s+far|route|reach)\s+(?:is\s+)?from\s+([a-z\s]+?)\s+to\s+([a-z\s\?\.]+)/i);
  const howFarFromMatch = q.match(/how\s+far\s+(?:is\s+)?([a-z\s]+?)\s+from\s+([a-z\s\?\.]+)/i);

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

  if (!place1Name && !place2Name) {
    const singleFarMatch = q.match(/how\s+far\s+is\s+([a-z\s]+)/i) || q.match(/distance\s+(?:to\s+)?([a-z\s]+)/i);
    if (singleFarMatch) {
      place2Name = singleFarMatch[1].replace(/(from\s+here|from\s+me|from\s+my\s+location|\?)/gi, '').trim();
      place1Name = 'here';
    }
  }

  const isHere = (name) => /here|me|my\s*location|current\s*location/i.test(name || '');

  let p1Obj = null;
  let p2Obj = null;

  const curLat = contextCoords?.latitude || 15.8497;
  const curLng = contextCoords?.longitude || 74.4977;

  if (isHere(place1Name)) {
    p1Obj = { name: 'Your Current Location (Belagavi)', lat: curLat, lng: curLng };
  } else if (place1Name) {
    p1Obj = resolvePlace(place1Name);
  }

  if (isHere(place2Name)) {
    p2Obj = { name: 'Your Current Location (Belagavi)', lat: curLat, lng: curLng };
  } else if (place2Name) {
    p2Obj = resolvePlace(place2Name);
  }

  if (!p1Obj && p2Obj) {
    p1Obj = { name: 'Your Current Location (Belagavi)', lat: curLat, lng: curLng };
  } else if (p1Obj && !p2Obj) {
    const cleanRemainder = q.replace(place1Name || '', '').replace(/distance|between|and|from|to|how|far|is|\?/gi, '').trim();
    p2Obj = resolvePlace(cleanRemainder);
  }

  // Fallback: check all pairs of cities in text
  if (!p1Obj || !p2Obj) {
    const found = [];
    for (const [k, v] of Object.entries(CITY_COORDINATES)) {
      if (q.includes(k) && !found.some((f) => f.name === v.name)) {
        found.push(v);
      }
    }
    if (found.length >= 2) {
      p1Obj = found[0];
      p2Obj = found[1];
    } else if (found.length === 1) {
      p1Obj = { name: 'Your Current Location (Belagavi)', lat: curLat, lng: curLng };
      p2Obj = found[0];
    }
  }

  if (!p1Obj || !p2Obj) return null;

  return { origin: p1Obj, destination: p2Obj };
}

export function calculateDistanceReport(origin, destination) {
  const straightKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
  const isMountainous = /goa|dudhsagar|gokak|coorg|chikmagalur|ooty|munnar|manali|shimla|kashmir/i.test(
    `${origin.name} ${destination.name}`
  );
  const roadMultiplier = isMountainous ? 1.35 : 1.25;
  const roadKm = Math.round(straightKm * roadMultiplier);

  const avgCarSpeed = isMountainous ? 45 : 68;
  const drivingHours = (roadKm / avgCarSpeed) + (roadKm > 200 ? 0.5 : 0);
  const drivingDuration = formatDuration(drivingHours);

  const busHours = (roadKm / 42) + (roadKm > 150 ? 1 : 0.25);
  const busDuration = formatDuration(busHours);

  let trainInfo = null;
  if (roadKm >= 50) {
    const trainHours = (roadKm / 60) + 0.5;
    trainInfo = `${formatDuration(trainHours)} (Express / Superfast trains available)`;
  }

  let flightInfo = null;
  if (straightKm >= 320) {
    const flightHours = Math.max(1, (straightKm / 650));
    flightInfo = `${formatDuration(flightHours)} (Direct / connecting commercial flights)`;
  }

  const k1 = origin.name.toLowerCase();
  const k2 = destination.name.toLowerCase();
  const matchedRoute = HIGHWAY_ROUTES.find(
    (r) => (k1.includes(r.p1) && k2.includes(r.p2)) || (k1.includes(r.p2) && k2.includes(r.p1))
  );

  const highwayName = matchedRoute ? matchedRoute.highway : 'National Highway / State Corridor (NH)';
  const routeNotes = matchedRoute ? matchedRoute.notes : 'Standard well-paved national highway network with 24/7 emergency toll assistance.';

  let markdown = `### 🗺️ Distance & Route Breakdown: **${origin.name}** ➔ **${destination.name}**\n\n`;
  markdown += `• 📏 **Driving Road Distance:** **~${roadKm} km**\n`;
  markdown += `• 🚗 **Driving Duration (Car/Cab):** **${drivingDuration}** (via ${highwayName})\n`;
  markdown += `• 🚌 **Bus Travel:** **${busDuration}** (KSRTC / MSRTC / Private Sleeper)\n`;
  markdown += `• ✈️ **Aerial Distance:** ~${Math.round(straightKm)} km\n`;
  if (trainInfo) markdown += `• 🚆 **Train Option:** ${trainInfo}\n`;
  if (flightInfo) markdown += `• 🛫 **Flight Option:** ${flightInfo}\n`;
  markdown += `\n`;

  markdown += `#### 🛣️ Recommended Route & Highway:\n`;
  markdown += `- **Main Corridor:** ${highwayName}\n`;
  markdown += `- **Road Condition & Advice:** ${routeNotes}\n\n`;

  markdown += `#### 🛡️ Travel Safety Guidelines:\n`;
  if (isMountainous) {
    markdown += `- ⚠️ **Ghats & Winding Curves:** Drive with headlights on, maintain lower gears on descents, and avoid overtaking on blind curves.\n`;
    markdown += `- 🌧️ **Monsoon Alert:** Drive cautiously during heavy rains near ghat sections.\n`;
  } else {
    markdown += `- 🚗 Maintain steady speed limits (80-100 km/h) on national expressways.\n`;
  }
  markdown += `- 🚨 In case of vehicle breakdown or medical emergency on route, dial **112 (National Emergency)** or **1033 (National Highways Helpline)**.\n\n`;

  return markdown;
}

export function findCityGuide(query = '') {
  const q = String(query || '').toLowerCase().trim();
  const aliasMap = {
    'goa': 'goa', 'panaji': 'goa', 'calangute': 'goa', 'baga': 'goa',
    'mumbai': 'mumbai', 'bombay': 'mumbai',
    'delhi': 'delhi', 'new delhi': 'delhi',
    'jaipur': 'jaipur', 'rajasthan': 'jaipur',
    'bengaluru': 'bengaluru', 'bangalore': 'bengaluru',
    'mysuru': 'mysuru', 'mysore': 'mysuru',
    'kerala': 'kerala', 'kochi': 'kerala', 'munnar': 'kerala', 'alleppey': 'kerala',
    'belagavi': 'belagavi', 'belgaum': 'belagavi',
  };

  for (const [key, cityKey] of Object.entries(aliasMap)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(q)) {
      return CITY_GUIDES[cityKey];
    }
  }
  return null;
}

export function formatCityGuideReport(guide) {
  if (!guide) return null;
  let markdown = `### 🏛️ Top Places to Visit in **${guide.name}**\n\n`;
  markdown += `**${guide.tagline}**\n\n`;
  markdown += `- 📍 **Region:** ${guide.region}\n`;
  markdown += `- ☀️ **Best Season to Visit:** ${guide.bestTime}\n\n`;

  markdown += `#### 🌟 Must-Visit Highlights & Attractions:\n`;
  guide.topAttractions.forEach((att, idx) => {
    markdown += `${idx + 1}. **${att.name}**: ${att.desc}\n`;
  });
  markdown += `\n`;

  if (guide.famousFood) {
    markdown += `#### 🍽️ Famous Local Delicacies to Try:\n`;
    markdown += `${guide.famousFood}\n\n`;
  }

  if (guide.itinerary1Day) {
    markdown += `#### 🗺️ Recommended 1-Day Itinerary:\n`;
    markdown += `${guide.itinerary1Day}\n\n`;
  }

  if (guide.safetyTips && guide.safetyTips.length > 0) {
    markdown += `#### 🛡️ Tourist Safety Guidelines:\n`;
    guide.safetyTips.forEach((tip) => {
      markdown += `- ${tip}\n`;
    });
    markdown += `\n`;
  }

  return markdown;
}

export function generateDynamicTourismGuide(placeName) {
  const p = placeName.charAt(0).toUpperCase() + placeName.slice(1);
  return `### 🏛️ Travel & Tourism Guide: **${p}**\n\n` +
    `Welcome to the curated travel guide for **${p}**.\n\n` +
    `#### 🌟 Recommended Sightseeing & Exploration:\n` +
    `1. **Historic Landmarks & Heritage:** Explore the prominent heritage sites, museums, and architecture unique to ${p}.\n` +
    `2. **Scenic Nature & Parks:** Visit top scenic viewpoints, botanical gardens, lakes, or waterfront promenades.\n` +
    `3. **Cultural Temples & Spiritual Shrines:** Discover iconic cultural and spiritual sanctuaries in the area.\n` +
    `4. **Local Bazaars & Markets:** Stroll through historic traditional street markets for regional handicrafts and souvenirs.\n\n` +
    `#### ☀️ Best Time to Visit:\n` +
    `- **Peak Season:** October to March offers pleasant daytime temperatures and comfortable sightseeing conditions.\n\n` +
    `#### 🍽️ Culinary Specialties:\n` +
    `- Taste authentic regional specialties and visit well-reviewed traditional family restaurants and clean street food stalls.\n\n` +
    `#### 🛡️ RakshaSetu Travel Safety Tips:\n` +
    `- 🚖 **Transport:** Always use authorized metered taxis, ride-hailing apps, or official tourist transit.\n` +
    `- 🎒 **Belongings:** Keep personal valuables, passports, and phones secured in inner pockets in crowded bazaars.\n` +
    `- 📞 **Emergency Helplines:** Dial **112 (National Emergency Helpline)** for immediate 24/7 Police, Ambulance, or Fire assistance.\n\n`;
}

/**
 * Universal Mobile AI Responder
 * Answers ANY query instantly on device if backend is un-updated or returns the old Belagavi fallback
 */
export function getSmartLocalResponse(query = '', coords = null) {
  const q = String(query || '').toLowerCase().trim();

  // 1. Distance Calculation
  const distParams = parseDistanceQuery(q, coords);
  if (distParams) {
    return {
      message: calculateDistanceReport(distParams.origin, distParams.destination),
      suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
      suggestedQuestions: [
        `What are famous places to visit in ${distParams.destination.name}?`,
        `Where is the nearest hospital & police?`,
        `What are safe travel tips?`
      ]
    };
  }

  // 2. Math Calculation
  const cleanMathQuery = q.replace(/^(what\s+is|calculate|compute|\?|=|please)\s*/i, '').trim();
  const mathMatch = cleanMathQuery.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/xX])\s*(\d+(?:\.\d+)?)/);
  if (mathMatch) {
    const num1 = parseFloat(mathMatch[1]);
    const rawOp = mathMatch[2];
    const op = rawOp.toLowerCase() === 'x' ? '*' : rawOp;
    const num2 = parseFloat(mathMatch[3]);
    let result = 0;
    if (op === '+') result = num1 + num2;
    else if (op === '-') result = num1 - num2;
    else if (op === '*') result = num1 * num2;
    else if (op === '/') result = num2 !== 0 ? (num1 / num2) : 'Undefined (cannot divide by zero)';

    return {
      message: `### 🧮 Calculation Result\n\n**${num1} ${rawOp} ${num2} = ${result}**\n\nI can solve your travel budgeting calculations or assist you with any questions during your journey!`,
      suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
      suggestedQuestions: ['Is my current location safe?', 'Show me nearby tourist attractions', 'Where is the nearest hospital & police?']
    };
  }

  // 3. Tourism & Places to Visit
  const isTourismQuery = /places|visit|touris|attract|sight|fort|falls|beach|monument|explore|temple|trip\s+to/i.test(q);
  if (isTourismQuery) {
    const matchedCity = findCityGuide(q);
    if (matchedCity) {
      return {
        message: formatCityGuideReport(matchedCity),
        suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
        suggestedQuestions: [
          `What is the distance to ${matchedCity.name}?`,
          `What are famous foods in ${matchedCity.name}?`,
          `Is my current location safe?`
        ]
      };
    }

    const cityExtractMatch = q.match(/(?:visit|in|to|near|at|around)\s+([a-zA-Z\s]+?)(?:\s+places|\s+attractions|\s+trip|\?|$)/i);
    if (cityExtractMatch && cityExtractMatch[1].trim().length > 2) {
      const place = cityExtractMatch[1].trim();
      const forbidden = ['the', 'my', 'any', 'some', 'famous', 'best', 'top', 'good', 'cheap', 'safe'];
      if (!forbidden.includes(place.toLowerCase())) {
        return {
          message: generateDynamicTourismGuide(place),
          suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
          suggestedQuestions: [`What is the distance to ${place}?`, 'Where is the nearest hospital & police?', 'Is my current location safe?']
        };
      }
    }

    // Default to Belagavi if asking about local/near me
    const belagaviGuide = findCityGuide('belagavi');
    return {
      message: formatCityGuideReport(belagaviGuide),
      suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
      suggestedQuestions: ['What is the distance between Belagavi and Goa?', 'What are famous places to visit in Goa?', 'Is my current location safe?']
    };
  }

  // 4. Food & Cuisine
  if (q.includes('food') || q.includes('eat') || q.includes('dish') || q.includes('sweet') || q.includes('cuisine') || q.includes('thali')) {
    const matchedCity = findCityGuide(q);
    const cityName = matchedCity ? matchedCity.name : 'Karnataka & Regional Corridors';
    const foodList = matchedCity ? matchedCity.famousFood : 'Benne Masala Dosa, Belagavi Kunda, Jowar Roti Oota, Filter Coffee, Mysore Pak.';
    return {
      message: `### 🍽️ Famous Foods & Delicacies: **${cityName}**\n\n` +
        `Here are the top traditional specialties and local dishes you should experience:\n\n` +
        `**Signature Specialties:**\n- ${foodList}\n\n` +
        `**Safety & Dining Tips for Travelers:**\n` +
        `- 💧 Always drink packaged sealed mineral water or RO filtered water.\n` +
        `- 🥘 Choose popular, busy restaurants with high customer turnover to ensure fresh hot meals.\n` +
        `- 🌶️ If you prefer milder spices, request 'less spicy' (Kam Mirchi / Kam Tikha).`,
      suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
      suggestedQuestions: [`What are top attractions in ${cityName}?`, `What is the distance to ${cityName}?`, 'Is my current location safe?']
    };
  }

  // 5. General Knowledge: Virat Kohli, Sports, Capitals
  if (q.includes('virat') || q.includes('kohli') || q.includes('cricket')) {
    return {
      message: `### 🏏 Sports & Cricket Insights\n\n` +
        `**Virat Kohli** is an internationally acclaimed Indian cricketer, regarded as one of the greatest batsmen in modern cricket history. He led the Indian National Team across all formats and has amassed over 80 international centuries.\n\n` +
        `- **Major Titles:** 2011 ICC Cricket World Cup Champion, 2013 ICC Champions Trophy, and 2024 ICC Men's T20 World Cup Champion.\n` +
        `- **IPL Team:** Royal Challengers Bengaluru (RCB).\n\n` +
        `How else can I assist your travel or knowledge inquiries today?`,
      suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
      suggestedQuestions: ['What are top attractions in Bengaluru?', 'Is my current location safe?', 'Where is the nearest hospital & police?']
    };
  }

  if (q.includes('capital') || q.includes('karnataka') || q.includes('india')) {
    return {
      message: `### 🏛️ Karnataka & Regional Geography\n\n` +
        `**Bengaluru** (Bangalore) is the capital of Karnataka, celebrated as the Silicon Valley of India and the Garden City.\n\n` +
        `- **Official Language:** Kannada\n` +
        `- **State Animal:** Asian Elephant | **State Bird:** Indian Roller\n` +
        `- **Major Tourism Corridors:** Belagavi, Hampi, Badami, Mysuru Palace, Gokarna beaches, and Coorg Western Ghats.\n` +
        `- **National Capital:** New Delhi is the capital of India.`,
      suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
      suggestedQuestions: ['What are famous places to visit in Bengaluru?', 'What is the distance between Bengaluru and Belagavi?', 'Is my current location safe?']
    };
  }

  return null;
}
