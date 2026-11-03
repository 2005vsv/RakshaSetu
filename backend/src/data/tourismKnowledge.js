/**
 * Curated Tourism & Safety Knowledgebase for RAG (Retrieval-Augmented Generation)
 * Used by Raksha Setu AI Tourist Safety Assistant.
 */

const TOURISM_DESTINATIONS = [
  {
    id: "belagavi-fort",
    name: "Belagavi Fort & Kamal Basti",
    region: "Belagavi, Karnataka",
    category: "Heritage & History",
    coordinates: { latitude: 15.8587, longitude: 74.5215 },
    timings: "8:00 AM - 6:30 PM (Open all days)",
    entryFee: "Free (Nominal parking fee)",
    safetyRating: "Safe (Green Zone)",
    familyFriendly: true,
    bestTimeToVisit: "October to March; pleasant evenings year-round",
    summary:
      "A 13th-century stone fortress built by Jaya Raya of the Ratta dynasty, later fortified by the Adil Shahi sultans. Within its ramparts stands Kamal Basti (a stunning late-Chalukyan Jain temple famous for its intricate lotus-carved ceiling) alongside historic mosques and the Ramakrishna Mission Ashram where Swami Vivekananda stayed in 1892.",
    highlights: [
      "Kamal Basti (Jain temple with monolithic stone pillars and lotus dome ceiling)",
      "Safa Masjid (historic 16th-century Adil Shahi mosque)",
      "Ramakrishna Mission Ashram (Swami Vivekananda historic memorial room)",
      "Ancient fortified stone moat and walking ramparts",
    ],
    safetyTips: [
      "Keep to marked stone pathways; climbing outer parapet walls is restricted.",
      "Moat area water is deep and untreated—swimming or leaning over boundary rails is strictly prohibited.",
      "Police outpost and tourist assistance booth located at the main southern gate.",
      "Nearest Emergency Hospital: Belagavi Civil & District Hospital (1.4 km).",
    ],
    recommendedDuration: "2 to 3 hours",
    nearestPoliceStation: "Camp Police Station, Belagavi (1.1 km)",
    nearestHospital: "District Civil Hospital, Belagavi (1.4 km)",
  },
  {
    id: "military-mahadeva-temple",
    name: "Military Mahadeva Temple (Camp)",
    region: "Belagavi, Karnataka",
    category: "Spiritual & Nature",
    coordinates: { latitude: 15.8450, longitude: 74.5080 },
    timings: "6:00 AM - 12:00 PM, 4:00 PM - 8:30 PM",
    entryFee: "Free",
    safetyRating: "Extremely Safe (Army Cantonment Zone)",
    familyFriendly: true,
    bestTimeToVisit: "Throughout the year; peaceful morning or evening aarti",
    summary:
      "Built and maintained with immaculate precision by the Maratha Light Infantry Regimental Centre (MLIRC). Features a beautifully sculpted black stone Shiva temple surrounded by lush manicured botanical gardens, a mini deer and bird enclosure, and water fountain.",
    highlights: [
      "Black granite sanctum of Lord Shiva with peaceful chanting atmosphere",
      "Pristine landscaped army cantonment gardens and children play lawns",
      "Mini aviary and deer park within campus perimeter",
    ],
    safetyTips: [
      "Strict military decorum and cleanliness maintained; zero-littering zone.",
      "Footwear must be deposited at the free token counter before garden entrance.",
      "Cantonment military police patrol the zone 24/7.",
    ],
    recommendedDuration: "1 to 2 hours",
    nearestPoliceStation: "Camp Police Station (900m)",
    nearestHospital: "Military Hospital Belagavi / KLE Hospital (2.5 km)",
  },
  {
    id: "gokak-falls",
    name: "Gokak Falls",
    region: "Gokak, Belagavi District (65 km from city)",
    category: "Waterfall & Nature",
    coordinates: { latitude: 16.1824, longitude: 74.7963 },
    timings: "7:00 AM - 6:00 PM",
    entryFee: "₹10 per person",
    safetyRating: "Caution (Orange Zone near cliff edges)",
    familyFriendly: true,
    bestTimeToVisit: "July to November (peak monsoon and post-monsoon roar)",
    summary:
      "Known as the 'Niagara of Karnataka', the Ghataprabha River takes a horseshoe leap of 177 feet (52 meters) over a rugged sandstone cliff into a picturesque red gorge. Famous for its historic 1907 pedestrian suspension bridge hanging 14 meters above the water and the 1887 heritage cotton mill.",
    highlights: [
      "177 ft horseshoe waterfall roaring into gorge",
      "201-meter historic hanging wire-rope suspension bridge",
      "11th-century Chalukyan Mahalingeshwara temple on the river bank",
    ],
    safetyTips: [
      "⚠️ HIGH SAFETY WARNING: Wet moss-covered rocks are extremely slippery. NEVER jump railings or climb down unauthorized gorge cliffs.",
      "Crossing suspension bridge in groups of max 20; swinging or shaking the bridge is strictly prohibited by police.",
      "River currents below the drop are fierce with hidden whirlpools; swimming is 100% banned.",
      "Local Gokak Police outpost is stationed at the viewpoint entry.",
    ],
    recommendedDuration: "3 to 4 hours (Day trip from Belagavi)",
    nearestPoliceStation: "Gokak Town Police Station (6 km)",
    nearestHospital: "Gokak Taluka Government Hospital (6.5 km)",
  },
  {
    id: "rajhansgad-yellur-fort",
    name: "Rajhansgad (Yellur) Fort",
    region: "Yellur, Belagavi (15 km from city centre)",
    category: "Fortress & Trekking",
    coordinates: { latitude: 15.7483, longitude: 74.5292 },
    timings: "6:00 AM - 6:30 PM (Entry restricted after dark)",
    entryFee: "Free",
    safetyRating: "Safe to Moderate (Hill terrain)",
    familyFriendly: true,
    bestTimeToVisit: "Monsoon and winter mornings for mist and cool breeze",
    summary:
      "A scenic hilltop stone fortress perched at 2,500 feet elevation, historically ruled by the Ratta, Maratha, and Peshwa rulers. Offers spectacular 360-degree aerial views of the Belagavi plateau, green agricultural valleys, and the Sahyadri mountain ridge.",
    highlights: [
      "Restored stone battlements and cannon bastion viewpoints",
      "Temple dedicated to Goddess Siddheshwari inside the fort sanctum",
      "Panoramic photography point across the Belagavi valley",
    ],
    safetyTips: [
      "Wear sturdy walking shoes; steps can be slick during rain.",
      "Carry drinking water and sun hat; limited shops on the hilltop.",
      "Vacate the fort summit before sunset (6:00 PM) as the hill road has minimal lighting.",
    ],
    recommendedDuration: "2 to 3 hours",
    nearestPoliceStation: "Vadgaon Police Station (12 km)",
    nearestHospital: "Udyambag Multispeciality Hospital (10 km)",
  },
  {
    id: "tillari-ghat-forest",
    name: "Tillari Ghats & Waterfalls",
    region: "Belagavi - Maharashtra/Goa border (~45 km)",
    category: "Mountain Pass & Wilderness",
    coordinates: { latitude: 15.8234, longitude: 74.2045 },
    timings: "Daylight only (Closed 6:00 PM - 6:00 AM by Forest Dept)",
    entryFee: "Checkpost entry pass ₹50",
    safetyRating: "High-Risk Zone (Red Zone during heavy monsoon & post-sunset)",
    familyFriendly: false,
    bestTimeToVisit: "September to January (Avoid July-August peak torrential rains)",
    summary:
      "A dramatic mountain pass descending from the Deccan plateau into the Konkan plains, surrounded by dense evergreen Western Ghats forest, mist waterfalls, and deep valleys. Popular for adventurous scenic drives.",
    highlights: [
      "Dense misty Western Ghats viewpoints and natural cascades",
      "Tillari Dam and Hydroelectric reservoir reservoir overlooks",
      "Rich biodiversity of flora, birds, and occasional wildlife sightings",
    ],
    safetyTips: [
      "🚨 RESTRICTED ZONE ADVISORY: Frequent landslide risk and zero visibility dense fog during monsoon.",
      "Narrow hairpin bends without guardrails in certain stretches—drive strictly below 25 km/h.",
      "Mobile network coverage is erratic or absent in the deep valley. Always notify someone before entering.",
      "Never park on blind turns or venture into untracked jungle paths.",
    ],
    recommendedDuration: "Half-day scenic drive",
    nearestPoliceStation: "Chandgad Police Station (22 km) / Belagavi Rural (38 km)",
    nearestHospital: "Civil Hospital Belagavi (45 km)",
  },
  {
    id: "hampi-heritage",
    name: "Hampi (UNESCO World Heritage Site)",
    region: "Vijayanagara District, Karnataka (~260 km from Belagavi)",
    category: "UNESCO World Heritage & Ancient Capital",
    coordinates: { latitude: 15.3350, longitude: 76.4600 },
    timings: "Sunrise to Sunset (Virupaksha Temple open 6:00 AM - 9:00 PM)",
    entryFee: "₹40 for Indians, ₹600 for Foreigners (Vittala & Zenana Enclosure combo ticket)",
    safetyRating: "Safe (Heritage Tourism Zone with Tourist Police)",
    familyFriendly: true,
    bestTimeToVisit: "October to February (Cooler climate for boulder exploration)",
    summary:
      "The legendary 14th-century capital of the Vijayanagara Empire situated on the banks of the Tungabhadra River. Spread over 4,100 hectares of otherworldly boulder-strewn landscapes, it showcases over 1,600 surviving monuments including monumental temples, royal palaces, aquatic pavilions, and bazaar streets.",
    highlights: [
      "Virupaksha Temple (active 7th-century shrine with sacred elephant Lakshmi)",
      "Vijaya Vittala Temple (iconic stone chariot, 56 musical granite pillars)",
      "Lotus Mahal and Elephant Stables (Indo-Islamic architectural marvels)",
      "Matanga Hill (highest vantage point for breathtaking sunrise over ruins)",
      "Tungabhadra River Coracle Boat Rides (traditional circular woven boats)",
    ],
    safetyTips: [
      "☀️ Intense dry heat: Carry minimum 2L water, sunscreen, and wide-brim hat. Stay hydrated.",
      "Wear sports shoes with good grip—climbing giant granite boulders in flip-flops causes sprains.",
      "🏊 River Safety: Tungabhadra currents are dangerously deceptively swift with deep suction whirlpools. SWIMMING IS STRICTLY FORBIDDEN. Only take certified coracle rides with life jackets.",
      "🐒 Monkey Warning: Langurs and macaques near Virupaksha and Hemakuta hill snatch food, sunglasses, and open bottles.",
      "Dress code: Modest attire required inside active sanctums (shoulders and knees covered).",
    ],
    recommendedDuration: "2 to 3 days full tour",
    nearestPoliceStation: "Hampi Tourist Police Station (Near Virupaksha Temple Bazaar)",
    nearestHospital: "Taluka Hospital Kamalapura (4 km) / District Hospital Hospet (12 km)",
  },
  {
    id: "badami-caves",
    name: "Badami Cave Temples & Agastya Lake",
    region: "Bagalkote District, Karnataka (~140 km from Belagavi)",
    category: "Rock-Cut Architecture & Heritage",
    coordinates: { latitude: 15.9189, longitude: 75.6829 },
    timings: "9:00 AM - 5:30 PM",
    entryFee: "₹25 for Indians, ₹300 for Foreigners",
    safetyRating: "Safe (Archeological Survey of India Protected)",
    familyFriendly: true,
    bestTimeToVisit: "October to March",
    summary:
      "Capital of the early Chalukyas (6th - 8th century), renowned for 4 rock-cut cave temples carved into red sandstone cliffs. Cave 1 is dedicated to Nataraja Shiva (18 arms with 81 dance poses), Caves 2 and 3 to Vishnu incarnations, and Cave 4 to Jain Tirthankaras, all overlooking serene Agastya Lake.",
    highlights: [
      "Cave 1: 18-armed dancing Shiva Nataraja relief sculpture",
      "Cave 3: Monumental rock carvings of Trivikrama and Narasimha",
      "Bhutanatha Temples: 7th-century shrines extending into Agastya Lake waters",
      "North Fort and Badami Archaeological Museum",
    ],
    safetyTips: [
      "Watch out for aggressive monkeys on the stone staircases—keep backpacks zipped.",
      "Steps are steep and uneven; elder tourists should use handrail supports.",
      "Do not step into Agastya Lake beyond the marked bathing ghat steps.",
    ],
    recommendedDuration: "Full day (can be combined with Pattadakal and Aihole)",
    nearestPoliceStation: "Badami Town Police Station (1.2 km)",
    nearestHospital: "Community Health Centre Badami (1.8 km)",
  },
];

const EMERGENCY_PROTOCOLS = {
  generalDistress: {
    title: "Immediate Emergency Protocol",
    steps: [
      "1. Tap '🚨 Trigger SOS' in Raksha Setu to broadcast GPS coordinates to Belagavi Police Control Room.",
      "2. Dial Police Control (112) or Ambulance (108) directly from the app dialer.",
      "3. Stay calm and remain in a well-lit, populated public area or registered hotel lobby.",
      "4. Keep your phone screen active and battery saver enabled if charge is low.",
      "5. If you cannot speak the local language, open the '🗣️ Emergency Voice Board' to play Kannada/Hindi audio to locals.",
    ],
  },
  medicalEmergency: {
    title: "Medical Assistance Protocol",
    steps: [
      "1. Immediately call 108 (National Emergency Ambulance Service).",
      "2. Locate the nearest 24/7 hospital using Raksha Setu's 'Nearby Safe Havens' locator.",
      "3. If heat exhaustion / dehydration: Move to shade, loosen tight clothing, sip cool salted water or ORS.",
      "4. If trauma or bleeding: Apply firm continuous pressure with clean cloth; keep injured limb elevated.",
      "5. Share live GPS location with emergency responders.",
    ],
  },
  lostOrStranded: {
    title: "Lost or Stranded Tourist Guide",
    steps: [
      "1. Do NOT panic or wander further into unpaved or unlit alleys or forest tracks.",
      "2. Check Raksha Setu Radar—it highlights your exact GPS pin and nearest police station or safe haven.",
      "3. Look for the nearest landmark: main road, temple tower, petrol pump, or government school.",
      "4. Show your Digital ID Pass (QR code) or use Emergency Voice Board: 'I am lost, please direct me to police station'.",
    ],
  },
  restrictedZoneAlert: {
    title: "Restricted Zone Entry Advisory",
    steps: [
      "1. You have stepped into a high-risk or restricted geofence perimeter.",
      "2. Turn back immediately along your incoming path to return to the designated green safety corridor.",
      "3. Do not cross warning barriers, fence lines, or unmapped dirt trails.",
      "4. If vehicle is broken down or you cannot walk out, tap SOS to dispatch tourist police patrol.",
    ],
  },
};

const TRAVEL_SAFETY_TIPS = {
  soloTravel: [
    "Always register your trip in Raksha Setu's 'Trips' tab so safety monitors know your active route.",
    "Avoid unlit streets and desolate monuments after 7:00 PM.",
    "Use only pre-paid or app-based verified cabs or authorized auto-rickshaw stands.",
    "Keep emergency numbers (112, 108, 1091) on speed dial.",
  ],
  familyTravel: [
    "Keep children within arm's reach near open water bodies (Gokak Falls, Hampi Tungabhadra river).",
    "Have each family member carry a photo or screenshot of the hotel address and Raksha Setu ID Pass.",
    "Carry a portable first-aid kit with rehydration salts (ORS), band-aids, and mosquito repellent.",
  ],
  packingChecklist: [
    "Government ID card (Aadhaar / Passport / Voter ID) + Raksha Setu Digital ID Pass",
    "Charged portable power bank and charging cables",
    "Sturdy grip walking/trekking shoes (essential for fort and temple stairs)",
    "Wide-brim hat, UV sunglasses, and sunscreen",
    "Reusable water bottle with hydration salts",
    "Light rain jacket / umbrella during monsoon months (June - October)",
  ],
};

module.exports = {
  TOURISM_DESTINATIONS,
  EMERGENCY_PROTOCOLS,
  TRAVEL_SAFETY_TIPS,
};

