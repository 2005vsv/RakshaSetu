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
  {
    id: "fort-aguada-goa",
    name: "Fort Aguada & Calangute Beach",
    region: "Goa (North Goa Coast)",
    category: "Coastal Fortress & Beaches",
    coordinates: { latitude: 15.4920, longitude: 73.7737 },
    timings: "9:30 AM - 6:00 PM (Fort); Beaches open 24/7 (Lifeguards 7 AM - 6:30 PM)",
    entryFee: "₹25 for Fort Aguada; Beaches Free",
    safetyRating: "Safe (Lifeguards Active)",
    familyFriendly: true,
    bestTimeToVisit: "October to March (Pleasant sea breeze & water sports)",
    summary:
      "A 17th-century Portuguese fortress and lighthouse guarding the mouth of the Mandovi River. Below lie the world-famous golden sands of Calangute and Baga beaches, buzzing with water sports, beach shacks, and seafood.",
    highlights: [
      "17th-century Portuguese coastal fort and freshwater cistern",
      "Four-story lighthouse overlooking panoramic Arabian Sea",
      "Calangute and Baga beach water sports (parasailing, jet-ski)",
      "Vibrant beach shacks and authentic Goan seafood"
    ],
    safetyTips: [
      "Swim strictly between red-and-yellow flagged zones monitored by Drishti Marine lifeguards.",
      "Never swim in the sea after sunset or under the influence of alcohol.",
      "Wear ISI-certified helmets when riding rented scooters on coastal highways.",
      "Coastal Police Helpline: 1093 | Police: 112 | Ambulance: 108"
    ],
    recommendedDuration: "Full day (4 to 8 hours)",
    nearestPoliceStation: "Calangute Police Station (3.2 km)",
    nearestHospital: "Candolim Primary Health Centre / Manipal Hospital Goa (6 km)",
  },
  {
    id: "gateway-of-india-mumbai",
    name: "Gateway of India & Marine Drive",
    region: "Mumbai, Maharashtra",
    category: "Heritage & Coastal Promenade",
    coordinates: { latitude: 18.9220, longitude: 72.8347 },
    timings: "Open 24/7 (Ferry rides 9:00 AM - 5:30 PM)",
    entryFee: "Free",
    safetyRating: "Extremely Safe (24/7 Police Patrol)",
    familyFriendly: true,
    bestTimeToVisit: "November to February",
    summary:
      "The iconic 26-meter basalt triumphal arch built in 1924 overlooking Mumbai harbour and the historic Taj Mahal Palace Hotel. Nearby stretches Marine Drive (The Queen's Necklace), a 3.6 km coastal boulevard.",
    highlights: [
      "Gateway of India basalt triumphal arch and harbor waterfront",
      "Marine Drive (Queen's Necklace) sunset and nighttime promenade",
      "Ferry boats to UNESCO Elephanta Caves",
      "Historic Colaba Causeway shopping street and Irani cafes"
    ],
    safetyTips: [
      "Avoid sitting on Marine Drive promenade tetrapods during high tide in monsoon season.",
      "Use metered black-and-yellow taxis or ride-hailing apps (Uber/Ola).",
      "Keep wallets and phones secured in bags while visiting crowded bazaars."
    ],
    recommendedDuration: "3 to 4 hours",
    nearestPoliceStation: "Colaba Police Station (600m)",
    nearestHospital: "St. George's Hospital / Bombay Hospital (2.5 km)",
  },
  {
    id: "bangalore-palace-lalbagh",
    name: "Bangalore Palace & Lalbagh Botanical Garden",
    region: "Bengaluru, Karnataka",
    category: "Royal Heritage & Nature",
    coordinates: { latitude: 12.9988, longitude: 77.5921 },
    timings: "10:00 AM - 5:30 PM (Palace); 6:00 AM - 7:00 PM (Lalbagh)",
    entryFee: "₹250 (Palace); ₹30 (Lalbagh)",
    safetyRating: "Safe (Green Zone)",
    familyFriendly: true,
    bestTimeToVisit: "Year-round (Pleasant Bengaluru weather)",
    summary:
      "Tudor-style royal estate inspired by Windsor Castle built by the Wadiyar dynasty in 1878, featuring turreted parapets and vintage royal memorabilia. Lalbagh houses a 19th-century glasshouse inspired by London's Crystal Palace.",
    highlights: [
      "Tudor-style woodcarvings, ballroom, and royal Durbar Hall",
      "Lalbagh 19th-century Glass House and centuries-old botanical trees",
      "Cubbon Park and grand Vidhana Soudha legislative assembly"
    ],
    safetyTips: [
      "Use Namma Metro to bypass city road congestion.",
      "Only drink bottled water from certified food stalls inside parks."
    ],
    recommendedDuration: "4 to 5 hours",
    nearestPoliceStation: "Sadashivanagar Police Station (1.2 km)",
    nearestHospital: "Mallige Hospital / Manipal Hospital (2 km)",
  },
  {
    id: "mysore-palace",
    name: "Mysore Palace (Amba Vilas)",
    region: "Mysuru, Karnataka",
    category: "Royal Heritage & Palaces",
    coordinates: { latitude: 12.3051, longitude: 76.6551 },
    timings: "10:00 AM - 5:30 PM (Illuminated 7:00 PM - 7:45 PM on Sundays & holidays)",
    entryFee: "₹100 (Adults), ₹50 (Children)",
    safetyRating: "Extremely Safe (Heavy Police & Security Presence)",
    familyFriendly: true,
    bestTimeToVisit: "September to March (Spectacular during Dasara in Oct)",
    summary:
      "The official residence of the Wadiyar dynasty and seat of the Kingdom of Mysore. Built in Indo-Saracenic style with dome spires, stained glass ceilings, ornate golden thrones, and 100,000 illumination bulbs.",
    highlights: [
      "Grand Durbar Hall, Kalyana Mantapa (Marriage Pavilion), and Golden Throne",
      "100,000 incandescent light illumination spectacle on Sunday evenings",
      "Chamundi Hills temple and Brindavan Gardens musical fountain nearby"
    ],
    safetyTips: [
      "Footwear must be deposited at the free security token counter before entering palace halls.",
      "Buy authentic GI Mysore Silk and Sandalwood only from Government KSIC and Cauvery emporiums."
    ],
    recommendedDuration: "2 to 3 hours",
    nearestPoliceStation: "Devaraja Police Station (800m)",
    nearestHospital: "K.R. Hospital Mysore (1.2 km)",
  },
  {
    id: "taj-mahal-agra",
    name: "The Taj Mahal & Agra Fort",
    region: "Agra, Uttar Pradesh",
    category: "World Wonder & Mughal Architecture",
    coordinates: { latitude: 27.1751, longitude: 78.0421 },
    timings: "Sunrise to Sunset (CLOSED ON FRIDAYS)",
    entryFee: "₹50 (Indian citizens); ₹1100 (Foreign tourists)",
    safetyRating: "Extremely Safe (CISF & Tourist Police Protection)",
    familyFriendly: true,
    bestTimeToVisit: "October to March",
    summary:
      "An immense mausoleum of white marble, built in Agra between 1631 and 1648 by order of the Mughal emperor Shah Jahan in memory of his favourite wife. One of the universally admired masterpieces of the world's heritage.",
    highlights: [
      "Ivory-white marble dome, minarets, and semi-precious stone Pietra Dura inlay",
      "Reflecting lotus pool along Charbagh water canals",
      "Agra Fort and Mehtab Bagh sunset viewpoint across the Yamuna River"
    ],
    safetyTips: [
      "CLOSED on Fridays for general tourists.",
      "Book tickets online via official ASI website (asi.payumoney.com) to avoid unauthorized touts."
    ],
    recommendedDuration: "3 to 4 hours",
    nearestPoliceStation: "Tajganj Police Station (700m)",
    nearestHospital: "District Hospital Agra (2.5 km)",
  },
  {
    id: "hawa-mahal-amber-jaipur",
    name: "Hawa Mahal & Amber Fort",
    region: "Jaipur, Rajasthan",
    category: "Royal Fortresses & Palaces",
    coordinates: { latitude: 26.9239, longitude: 75.8267 },
    timings: "9:00 AM - 5:00 PM",
    entryFee: "₹50 (Indians); ₹200 (Foreigners) for Hawa Mahal",
    safetyRating: "Safe (Tourist Police Present)",
    familyFriendly: true,
    bestTimeToVisit: "October to March (Pleasant desert breeze)",
    summary:
      "The 'Palace of Winds' with its honeycomb-shaped pink sandstone façade of 953 lattice windows. Combined with the majestic hilltop Amber Fort showcasing Sheesh Mahal (Mirror Palace) and Rajput regal grandeur.",
    highlights: [
      "953 ornate lattice jharokhas of Hawa Mahal designed for royal ladies",
      "Amber Fort Sheesh Mahal (thousands of mirrored glass reflections)",
      "City Palace, Jantar Mantar observatory, and Nahargarh sunset view"
    ],
    safetyTips: [
      "Visit Amber Fort early in the morning to beat the afternoon heat.",
      "Bargain politely in traditional Johari and Bapu Bazaars for textiles and pottery."
    ],
    recommendedDuration: "Full day (5 to 6 hours)",
    nearestPoliceStation: "Manak Chowk Police Station (400m)",
    nearestHospital: "SMS Hospital Jaipur (3 km)",
  },
  {
    id: "alleppey-backwaters-kerala",
    name: "Alleppey Backwaters & Munnar",
    region: "Kerala (God's Own Country)",
    category: "Backwaters & Hill Station",
    coordinates: { latitude: 9.4981, longitude: 76.3388 },
    timings: "Houseboat check-in 12:00 PM; Tea Gardens open 9:00 AM - 5:00 PM",
    entryFee: "Houseboats ₹7,000 - ₹15,000/night; Tea gardens nominal entry",
    safetyRating: "Safe (DTPC Certified)",
    familyFriendly: true,
    bestTimeToVisit: "September to March",
    summary:
      "Glide through serene palm-fringed lagoons, canals, and emerald paddy fields in a traditional wooden Kettuvallam houseboat. Head up to Munnar for rolling mist-clad tea plantations and fresh mountain air.",
    highlights: [
      "Overnight traditional houseboat cruise on Vembanad Lake canals",
      "Munnar rolling carpet of tea estates and Mattupetty Dam",
      "Authentic Kerala banana leaf Sadya feast and Ayurvedic massages"
    ],
    safetyTips: [
      "Always wear life jackets while on smaller canoes or motorboats in backwaters.",
      "Book houseboats with certified DTPC government green stickers for verified safety standards."
    ],
    recommendedDuration: "2 to 3 days",
    nearestPoliceStation: "Alappuzha South Police Station (2 km)",
    nearestHospital: "General Hospital Alappuzha (2.5 km)",
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

