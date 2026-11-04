/**
 * Comprehensive Multi-City Tourism Knowledge Base for RakshaSetu AI Tourist Assistant
 * Contains in-depth attractions, best season, food specialties, itineraries, and safety guidelines
 * for popular Indian and international destinations.
 */

const CITY_GUIDES = {
  // GOA
  goa: {
    name: 'Goa',
    region: 'Western Coastal India',
    tagline: 'Sun, Sand, Historic Portuguese Architecture & Sea',
    bestTime: 'October to March (Pleasant beach breeze & water sports)',
    topAttractions: [
      { name: 'Calangute & Baga Beach', desc: 'Lively beaches with water sports (parasailing, jet-ski), beach shacks, and vibrant atmosphere.' },
      { name: 'Fort Aguada & Lighthouse', desc: '17th-century Portuguese fortress with panoramic Arabian Sea views and ancient freshwater cistern.' },
      { name: 'Basilica of Bom Jesus (Old Goa)', desc: 'UNESCO World Heritage baroque church holding mortal remains of St. Francis Xavier.' },
      { name: 'Dudhsagar Waterfalls', desc: 'A majestic 4-tiered 310m waterfall on Mandovi river nestled inside Bhagwan Mahavir Wildlife Sanctuary.' },
      { name: 'Anjuna & Vagator Beaches', desc: 'Famous red cliffs overlooking the sea, flea market, and iconic Chapora Fort (Dil Chahta Hai point).' },
      { name: 'Palolem Beach (South Goa)', desc: 'Crescent-shaped serene beach with calm waters, dolphin spotting boat trips, and eco-friendly huts.' }
    ],
    famousFood: 'Goan Fish Curry Thali, Prawn Balchão, Bebinca sweet, Feni, Pork Vindaloo, Poi bread.',
    safetyTips: [
      '⚠️ Strict Beach Safety: Swim ONLY between red & yellow flags; never swim after sunset or under influence of alcohol.',
      'Drishti Marine lifeguards patrol all registered beaches from 7:00 AM to 6:30 PM.',
      'Renting 2-Wheelers: Always wear an ISI-certified helmet and carry valid driver license; police conduct regular checks.',
      'Emergency Helplines: 112 (Police) | 108 (Ambulance) | Coastal Police Helpline: 1093.'
    ],
    itinerary1Day: 'Morning: Fort Aguada -> Afternoon: Old Goa Basilica & Church -> Evening: Baga/Calangute sunset & Mandovi river cruise.',
  },

  // MUMBAI
  mumbai: {
    name: 'Mumbai',
    region: 'Maharashtra (Financial Capital)',
    tagline: 'The City of Dreams, Colonial Heritage & Coastal Glamour',
    bestTime: 'November to February (Cooler winter breeze along coastline)',
    topAttractions: [
      { name: 'Gateway of India & Colaba Causeway', desc: 'Iconic 26m basalt arch overlooking Mumbai harbour, facing the historic Taj Mahal Palace Hotel.' },
      { name: 'Marine Drive (Queen\'s Necklace)', desc: '3.6 km C-shaped coastal boulevard, best experienced during sunset and evening lights.' },
      { name: 'Elephanta Caves', desc: 'UNESCO rock-cut cave temples dating to the 5th-8th centuries dedicated to Lord Shiva, reached via ferry.' },
      { name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT)', desc: 'Victorian Gothic revival architecture landmark and bustling railway hub (UNESCO).' },
      { name: 'Bandra-Worli Sea Link & Bandra Fort', desc: 'Engineering marvel cable-stayed bridge and scenic Portuguese sea fort overlooking the Arabian Sea.' },
      { name: 'Juhu Beach & Chowpatty', desc: 'Bustling sandy beaches famous for iconic Mumbai street food stalls.' }
    ],
    famousFood: 'Vada Pav, Pav Bhaji, Bombay Duck fry, Misal Pav, Bhel Puri, Keema Pav at Irani Cafes.',
    safetyTips: [
      'Local Trains: Avoid rush hours (8:30-11:00 AM & 6:00-9:00 PM); keep wallets and phones secured in bags.',
      'Taxis & Autos: Always insist on fare meters or use pre-booked cab apps (Uber/Ola).',
      'Monsoon Safety: Avoid low-lying flooded roads and marine promenade during high tide alert days.',
      'Helplines: 112 (Police) | 100 | Mumbai Police Tourist Cell: 022-22620111.'
    ],
    itinerary1Day: 'Morning: Gateway of India & Colaba -> Afternoon: CSMT & Marine Drive stroll -> Evening: Bandra Bandstand & street food.',
  },

  // BENGALURU
  bengaluru: {
    name: 'Bengaluru (Bangalore)',
    region: 'Karnataka (Silicon Valley & Garden City)',
    tagline: 'Lush Botanical Parks, Tech Innovation, Craft Breweries & Palaces',
    bestTime: 'September to March (Pleasant climate year-round)',
    topAttractions: [
      { name: 'Bangalore Palace', desc: 'Tudor-style royal palace inspired by Windsor Castle with woodcarvings and vintage royal memorabilia.' },
      { name: 'Lalbagh Botanical Garden', desc: '240-acre garden housing a 19th-century glass house, lotus ponds, and rare century-old trees.' },
      { name: 'Cubbon Park & Vidhana Soudha', desc: 'Lush green lungs of the city surrounding the grand neo-Dravidian legislative assembly building.' },
      { name: 'ISKCON Sri Radha Krishna Temple', desc: 'One of the largest ISKCON temples in the world atop Hare Krishna Hill in Rajajinagar.' },
      { name: 'Bannerghatta Biological Park', desc: 'Forest safari, butterfly conservatory, zoo, and tiger sanctuary on the outskirts.' },
      { name: 'Church Street & Indiranagar', desc: 'Cosmopolitan high streets brimming with bookstores, cafes, live music, and artisanal dining.' }
    ],
    famousFood: 'Benne Masala Dosa (Vidyarthi Bhavan / CTR), Filter Coffee, Bisibelebath, Mysore Pak, Craft beer.',
    safetyTips: [
      'Namma Metro is the safest, fastest way to bypass Bengaluru traffic congestion.',
      'Late-night auto rides: Use ride-hailing apps or ensure GPS tracking is on.',
      'Emergency Helplines: 112 (Namma 112 Police) | 108 (Ambulance).'
    ],
    itinerary1Day: 'Morning: Lalbagh & CTR Dosa -> Afternoon: Bangalore Palace -> Evening: Cubbon Park, Vidhana Soudha & Church Street.',
  },

  // MYSURU
  mysuru: {
    name: 'Mysuru (Mysore)',
    region: 'Southern Karnataka',
    tagline: 'The City of Palaces, Sandalwood, Silk & Royal Heritage',
    bestTime: 'September to March (Especially during world-famous Dasara festivities in Oct)',
    topAttractions: [
      { name: 'Mysore Palace (Amba Vilas)', desc: 'Spectacular Indo-Saracenic royal residence with 100,000 light bulbs illuminating Sunday evenings.' },
      { name: 'Chamundi Hills & Sri Chamundeshwari Temple', desc: 'Hilltop shrine with 1,000 steps and the massive monolithic Nandi statue halfway up.' },
      { name: 'Brindavan Gardens & Musical Fountain', desc: 'Terraced Mughal gardens below the Krishnarajasagara (KRS) dam with illuminated water fountains.' },
      { name: 'Sri Chamarajendra Zoological Gardens', desc: 'One of India\'s oldest and most well-maintained zoos with rich animal diversity.' },
      { name: 'St. Philomena\'s Cathedral', desc: 'Neo-Gothic church with twin 175-foot spires inspired by Cologne Cathedral in Germany.' }
    ],
    famousFood: 'Authentic Mysore Pak sweet (Guru Sweet Mart), Mysore Masala Dosa, Mysore Bonda, Filter Kaapi.',
    safetyTips: [
      'Palace Security: Strict footwear deposit required; photography inside certain royal chambers is restricted.',
      'Beware of roadside touts claiming to sell genuine sandalwood or GI silk; purchase ONLY from Govt Cauvery Arts & KSIC Silk Emporiums.',
      'Helplines: 112 (Police) | 108 (Ambulance).'
    ],
    itinerary1Day: 'Morning: Chamundi Hills & Zoo -> Afternoon: Mysore Palace tour -> Evening: Brindavan Gardens light show.',
  },

  // BELAGAVI
  belagavi: {
    name: 'Belagavi (Belgaum)',
    region: 'North Karnataka (Cultural & Industrial Hub)',
    tagline: 'Historic Fortresses, Waterfalls, Cradle of Freedom & Sweet Kunda',
    bestTime: 'July to February (Monsoon brings majestic greenery and post-monsoon waterfalls)',
    topAttractions: [
      { name: 'Belagavi Fort & Kamal Basti', desc: '13th-century Ratta dynasty fort holding the intricately carved stone lotus-ceiling Kamal Basti Jain temple and historic mosques.' },
      { name: 'Military Mahadeva Temple', desc: 'Serene black-stone Shiva temple set inside pristine army cantonment botanical gardens.' },
      { name: 'Gokak Falls (65 km)', desc: 'Known as the Niagara of Karnataka; Ghataprabha river drops 177 ft into a rocky gorge spanned by a historic 1907 suspension bridge.' },
      { name: 'Rajhansgad (Yellur) Fort', desc: 'Hilltop fortress with panoramic 360-degree views of the valley and countryside.' },
      { name: 'Kote Kere Lake & Shivaji Garden', desc: 'Picturesque lake with boating, walking track, and India\'s tallest national flag mast (110m).' },
      { name: 'Tillari Ghats & Waterfalls', desc: 'Dense rainforest ghats with viewpoint gazebos on the border of Karnataka, Maharashtra, and Goa.' }
    ],
    famousFood: 'Belagavi Kunda sweet (Purohit Sweets), Karadantu of Gokak, Shenga Chutney, Jowar Roti Oota.',
    safetyTips: [
      'Gokak Falls warning: Rocks near the cliff edge are extremely slippery; DO NOT climb over safety railings.',
      'Tillari Ghats: Dense fog and hairpin turns; avoid driving late at night.',
      'Emergency Helplines: 112 (Police) | 108 (Ambulance) | Nearest Safe Haven: Udyambag Police & Hospital.'
    ],
    itinerary1Day: 'Morning: Belagavi Fort & Kamal Basti -> Afternoon: Military Mahadeva & Kote Kere -> Evening: Purohit Kunda & Rajhansgad Fort.',
  },

  // HAMPI
  hampi: {
    name: 'Hampi',
    region: 'Central Karnataka (UNESCO World Heritage Site)',
    tagline: 'The Forgotten Empire of Vijayanagara Amidst Boulder Hills',
    bestTime: 'October to February (Cooler months; summer temperatures reach 42°C)',
    topAttractions: [
      { name: 'Virupaksha Temple', desc: 'Ancient 7th-century operational shrine dedicated to Lord Shiva with an imposing 50m gopuram.' },
      { name: 'Vittala Temple & Iconic Stone Chariot', desc: 'Culmination of Vijayanagara architectural mastery featuring the world-famous carved Stone Chariot and musical pillars.' },
      { name: 'Matanga Hill Sunrise', desc: 'Highest point in Hampi providing breathtaking 360° sunrise views across the ancient temple ruins and boulder hills.' },
      { name: 'Lotus Mahal & Elephant Stables', desc: 'Zenana enclosure showcasing secular Indo-Islamic blended royal architecture.' },
      { name: 'Coracle Boat Ride on Tungabhadra River', desc: 'Traditional round woven reed boats navigating between rocky river islands.' }
    ],
    famousFood: 'Traditional South Indian Thali, Mango Lassi, Banana Leaf breakfast at hippie island cafes.',
    safetyTips: [
      '⚠️ River Warning: Tungabhadra river has strong undercurrents and hidden whirlpools; swimming is strictly banned.',
      'Hydration: Carry at least 2 liters of water and wear a sun hat; boulder terrain gets very hot by noon.',
      'Climbing boulders during rain: Highly slippery, stick to marked walking paths.',
      'Helpline: 112 (Police) | Hampi Tourist Police Post located near Virupaksha temple.'
    ],
    itinerary1Day: 'Sunrise: Matanga Hill -> Morning: Virupaksha & Hemakuta Hill -> Afternoon: Royal Enclosure & Lotus Mahal -> Sunset: Vittala Temple.',
  },

  // BADAMI & PATTADAKAL
  badami: {
    name: 'Badami, Pattadakal & Aihole',
    region: 'Bagalkote District, Karnataka',
    tagline: 'Cradle of Indian Temple Architecture & Rock-Cut Cave Shrines',
    bestTime: 'October to March',
    topAttractions: [
      { name: 'Badami Cave Temples', desc: '4 magnificent rock-cut cave shrines carved into red sandstone cliffs dedicated to Shiva, Vishnu, and Jain tirthankaras.' },
      { name: 'Agastya Lake & Bhutanatha Temples', desc: 'Tranquil 5th-century reservoir flanked by sandstone hills and historic waterfront temples.' },
      { name: 'Pattadakal UNESCO Monuments', desc: 'Harmonious blend of Dravidian and Nagara northern temple styles constructed by Chalukya emperors.' },
      { name: 'Aihole Temple Complex', desc: 'Over 120 stone temples dating back to the 6th century, including the famous horseshoe-shaped Durga Temple.' }
    ],
    famousFood: 'North Karnataka Jowar Roti thali with Yennegai (stuffed brinjal), Shenga Holige, Mirchi Bhajji.',
    safetyTips: [
      'Beware of wild monkeys around the cave temple steps; keep food and shiny items inside zipped bags.',
      'Wear sturdy footwear with grip for climbing steep sandstone steps.'
    ],
    itinerary1Day: 'Morning: Badami 4 Caves & Agastya Lake -> Afternoon: Pattadakal UNESCO temples -> Evening: Aihole Durga Temple.',
  },

  // COORG
  coorg: {
    name: 'Coorg (Kodagu)',
    region: 'Western Ghats, Karnataka',
    tagline: 'Scotland of India, Mist-Clad Mountains, Waterfalls & Coffee Estates',
    bestTime: 'October to April (or July-Sept for lush monsoon waterfalls)',
    topAttractions: [
      { name: 'Abbey Falls', desc: 'Cascading 70-foot waterfall framed by hanging bridge amidst dense spice and coffee plantations.' },
      { name: 'Raja\'s Seat (Madikeri)', desc: 'Scenic garden gazebo where the Kings of Kodagu watched sunsets over misty valleys.' },
      { name: 'Dubare Elephant Camp', desc: 'Camp on Kaveri river banks where tourists can assist with elephant bathing and feeding.' },
      { name: 'Namdroling Monastery (Golden Temple)', desc: 'Largest Tibetan Buddhist teaching centre in South India, with three 40-foot gilded Buddha statues.' },
      { name: 'Talakaveri & Brahmagiri Hills', desc: 'Sacred birthplace of River Kaveri atop the Brahmagiri hill range.' }
    ],
    famousFood: 'Authentic Pandi Curry, Kadambuttu (rice dumplings), Akki Roti, Bamboo Shoot curry, Estate Coffee.',
    safetyTips: [
      'Ghat Driving: Fog reduces visibility drastically on Madikeri-Mangaluru road; maintain low beam lights.',
      'Leech protection during monsoon trekking: Carry salt or apply eucalyptus oil before jungle walks.'
    ],
    itinerary1Day: 'Morning: Dubare Elephant Camp & Golden Temple -> Afternoon: Abbey Falls -> Evening: Raja\'s Seat sunset.',
  },

  // GOKARNA
  gokarna: {
    name: 'Gokarna',
    region: 'Uttara Kannada Coastal Karnataka',
    tagline: 'Pristine Beaches, Sacred Atmalinga Temple & Cliffside Treks',
    bestTime: 'October to March (Calm seas & pleasant tropical breeze)',
    topAttractions: [
      { name: 'Om Beach', desc: 'Naturally shaped like the auspicious Hindu sacred symbol \'Om\', famous for water sports and sunset cafes.' },
      { name: 'Kudle Beach', desc: 'Long stretch of golden sands lined with beach shacks and peaceful yoga retreats.' },
      { name: 'Mahabaleshwar Temple (Atmalinga)', desc: 'Revered 4th-century Shiva temple housing the sacred Pranalinga / Atmalinga.' },
      { name: 'Half Moon & Paradise Beaches', desc: 'Secluded beaches accessible via scenic hill trekking paths or motorboat rides.' },
      { name: 'Mirjan Fort (21 km)', desc: '16th-century laterite stone fortress enveloped in lush green moss.' }
    ],
    famousFood: 'Fresh Coastal Seafood, Nutella Banana Pancakes at shacks, Kokum juice, Neer Dosa.',
    safetyTips: [
      'Cliff Trekking: Never trek between beaches in the dark; rocks are rugged and unmarked.',
      'Sea swimming: Watch out for rip currents; avoid swimming during high tides or choppy seas.'
    ],
    itinerary1Day: 'Morning: Mahabaleshwar Temple darshan -> Midday: Kudle Beach -> Afternoon: Beach trek to Om Beach -> Sunset: Om Beach rock view.',
  },

  // DELHI
  delhi: {
    name: 'Delhi NCR',
    region: 'National Capital Territory of India',
    tagline: 'Heart of India, 8 Historic Cities, Grand Monuments & Street Food',
    bestTime: 'October to March (Pleasant winter climate; summer is extremely hot)',
    topAttractions: [
      { name: 'Red Fort (Lal Qila)', desc: '17th-century Mughal red sandstone imperial palace complex (UNESCO).' },
      { name: 'Qutub Minar', desc: '73m soaring victory tower built in 1192 surrounded by historic Mehrauli ruins and the rustless Iron Pillar.' },
      { name: 'India Gate & Kartavya Path', desc: '42m triumphal war memorial arch with eternal flame for soldiers.' },
      { name: 'Humayun\'s Tomb', desc: 'Magnificent garden-tomb precursor to the Taj Mahal, built in 1570.' },
      { name: 'Lotus Temple & Akshardham', desc: 'Modern architectural marvels celebrating Bahá\'í and Swaminarayan spiritual heritage.' },
      { name: 'Chandni Chowk & Jama Masjid', desc: 'One of India\'s largest mosques and historic wholesale spice & street food alleys.' }
    ],
    famousFood: 'Chole Bhature, Butter Chicken, Paranthas at Paranthe Wali Gali, Dahi Bhalla, Chaat, Mughlai Biryani.',
    safetyTips: [
      'Delhi Metro is world-class, air-conditioned, and the safest transit mode (first coach reserved for women).',
      'At busy markets (Chandni Chowk, Sarojini Nagar): Beware of pickpockets; keep phone and wallet in front pockets.',
      'Emergency Helplines: 112 (Police) | 1091 (Women Safety) | 108 (Ambulance).'
    ],
    itinerary1Day: 'Morning: Red Fort & Chandni Chowk -> Afternoon: India Gate & Humayun\'s Tomb -> Evening: Qutub Minar illuminated.',
  },

  // AGRA
  agra: {
    name: 'Agra',
    region: 'Uttar Pradesh (Mughal Heritage)',
    tagline: 'Home of the World Wonder: The Taj Mahal',
    bestTime: 'October to March',
    topAttractions: [
      { name: 'The Taj Mahal', desc: 'Universally admired ivory-white marble mausoleum built by Emperor Shah Jahan for Mumtaz Mahal.' },
      { name: 'Agra Fort', desc: 'Vast 16th-century red sandstone fortress housing Sheesh Mahal, Diwan-i-Aam, and Musamman Burj.' },
      { name: 'Fatehpur Sikri (37 km)', desc: 'Preserved royal ghost city with Buland Darwaza and Tomb of Salim Chishti.' },
      { name: 'Mehtab Bagh', desc: 'Charbagh garden complex on the opposite riverbank offering breathtaking reflection views of the Taj Mahal at sunset.' }
    ],
    famousFood: 'Agra Petha (Panchi Petha), Bedai & Jalebi, Mughlai Chicken, Tandoori delicacies.',
    safetyTips: [
      'Taj Mahal is CLOSED on Fridays for general visitors.',
      'Purchase tickets online via official ASI portal (asi.payumoney.com) to skip long lines and touts.',
      'Only electric golf carts / tongas are allowed within 500m of Taj Mahal to protect marble.'
    ],
    itinerary1Day: 'Sunrise: Taj Mahal -> Morning: Agra Fort -> Afternoon: Mehtab Bagh -> Evening: Sadar Bazaar shopping & Petha.',
  },

  // JAIPUR & RAJASTHAN
  jaipur: {
    name: 'Jaipur',
    region: 'Rajasthan (The Pink City)',
    tagline: 'Royal Forts, Opulent Palaces, Rajput Valour & Colorful Bazaars',
    bestTime: 'October to March (Pleasant sunny days and cool desert nights)',
    topAttractions: [
      { name: 'Hawa Mahal (Palace of Winds)', desc: '5-story pink sandstone façade with 953 ornate lattice windows (jharokhas).' },
      { name: 'Amber (Amer) Fort', desc: 'Hilltop fortress featuring the stunning Sheesh Mahal (Mirror Palace) and Maota lake reflection.' },
      { name: 'City Palace & Jantar Mantar', desc: 'Royal residence museum alongside the world\'s largest stone astronomical observatory (UNESCO).' },
      { name: 'Nahargarh Fort', desc: 'Perched on the edge of the Aravalli hills, unbeatable panoramic sunset viewpoint of Jaipur city.' },
      { name: 'Chokhi Dhani', desc: 'Ethnic Rajasthani village resort with folk dance, camel rides, and traditional thali banquet.' }
    ],
    famousFood: 'Dal Baati Churma, Laal Maas, Pyaaz Kachori (Rawat Misthan Bhandar), Ghevar sweet, Mawa Kachori.',
    safetyTips: [
      'Amber Fort: Visit early (8:30 AM) to avoid afternoon heat and crowds.',
      'Shopping: Bargaining is customary in Johari & Bapu Bazaars for handicrafts, bandhani, and blue pottery.',
      'Helplines: 112 (Police) | Tourist Assistance Booth at Hawa Mahal.'
    ],
    itinerary1Day: 'Morning: Amber Fort & Jal Mahal -> Afternoon: City Palace & Hawa Mahal -> Evening: Nahargarh sunset & Chokhi Dhani.',
  },

  // KERALA
  kerala: {
    name: 'Kerala (God\'s Own Country)',
    region: 'Southwestern Malabar & Coastal India',
    tagline: 'Emerald Backwaters, Misty Tea Estates, Ayurvedic Spas & Kathakali',
    bestTime: 'September to March (Winter) | June to August (For Ayurvedic Monsoon Rejuvenation)',
    topAttractions: [
      { name: 'Alleppey (Alappuzha) Houseboats', desc: 'Cruise peaceful palm-fringed canals, paddy fields, and lagoons in traditional Kettuvallam houseboats.' },
      { name: 'Munnar Tea Plantations', desc: 'Endless rolling carpet of emerald green tea estates, Mattupetty Dam, and Eravikulam National Park (Nilgiri Tahr).' },
      { name: 'Fort Kochi & Chinese Fishing Nets', desc: 'Colonial heritage town with Portuguese, Dutch, and Jewish history, spice markets, and art cafes.' },
      { name: 'Wayanad Wildlife & Chembra Peak', desc: 'Dense rainforests, heart-shaped lake trek, Edakkal caves, and elephant corridors.' },
      { name: 'Kovalam & Varkala Cliff Beaches', desc: 'Dramatic red laterite cliffs abutting the Arabian Sea with seaside cafes and yoga retreats.' }
    ],
    famousFood: 'Kerala Sadya feast on banana leaf, Appam with stew, Karimeen Pollichathu, Malabar Parotta, Banana chips.',
    safetyTips: [
      'Houseboat booking: Use verified DTPC (District Tourism Promotion Council) accredited boats for safety standards.',
      'Backwater canals: Life jackets are mandatory while boating or canoeing.',
      'Helplines: 112 (Police) | 108 (Ambulance).'
    ],
    itinerary1Day: 'Fort Kochi heritage walk & Kathakali centre -> Drive to Alleppey for backwater cruise & authentic fish curry.',
  },

  // HYDERABAD
  hyderabad: {
    name: 'Hyderabad',
    region: 'Telangana (City of Pearls & Nizams)',
    tagline: 'Historic Charminar, Golconda Fort, Ramoji Film City & World-Famous Biryani',
    bestTime: 'October to March',
    topAttractions: [
      { name: 'Charminar & Laad Bazaar', desc: '16th-century four-minaret monument surrounded by traditional lacquer bangle bazaars.' },
      { name: 'Golconda Fort', desc: 'Impregnable medieval fortress famous for acoustic marvels, diamond trade history, and evening sound & light show.' },
      { name: 'Ramoji Film City', desc: 'World\'s largest integrated film studio complex (Guinness World Records) with thematic entertainment.' },
      { name: 'Hussain Sagar Lake & Buddha Statue', desc: 'Heart-shaped urban lake featuring the world\'s tallest monolithic statue of Gautama Buddha.' },
      { name: 'Salar Jung Museum & Chowmahalla Palace', desc: 'Vast one-man collection of antiques and the ceremonial royal seat of the Asaf Jahi Nizams.' }
    ],
    famousFood: 'Authentic Hyderabadi Dum Biryani (Paradise / Bawarchi / Shah Ghouse), Haleem, Double Ka Meetha, Irani Chai with Osmania Biscuits.',
    safetyTips: [
      'Golconda Fort: Hire certified government guides at the entrance to understand acoustic clapping points.',
      'Hyderabad Metro connects all major tourist nodes smoothly.'
    ],
    itinerary1Day: 'Morning: Golconda Fort -> Afternoon: Chowmahalla Palace & Charminar -> Evening: Hussain Sagar boat ride & Biryani dinner.',
  },

  // VARANASI
  varanasi: {
    name: 'Varanasi (Kashi / Banaras)',
    region: 'Uttar Pradesh (Spiritual Capital of India)',
    tagline: 'One of the World\'s Oldest Living Cities on the Sacred River Ganga',
    bestTime: 'October to March (Mornings are peaceful with pleasant boat rides)',
    topAttractions: [
      { name: 'Dashashwamedh Ghat & Evening Ganga Aarti', desc: 'Mesmerizing synchronized spiritual ritual performed with grand brass lamps and Sanskrit chants.' },
      { name: 'Kashi Vishwanath Temple (Golden Temple)', desc: 'One of the 12 sacred Jyotirlingas, newly renovated with the expansive Kashi Vishwanath Corridor.' },
      { name: 'Sunrise Boat Ride on River Ganga', desc: 'Rowing from Assi Ghat to Manikarnika Ghat witnessing early morning prayers and age-old traditions.' },
      { name: 'Sarnath (10 km)', desc: 'Sacred deer park where Lord Buddha gave his first sermon; home of the Lion Capital of Ashoka (India\'s national emblem).' }
    ],
    famousFood: 'Banarasi Paan, Kachori Jalebi, Malaiyo sweet (winter), Tamatar Chaat (Kashi Chaat Bhandar), Thandai.',
    safetyTips: [
      'Ghat steps can be slick; wear slip-resistant walking shoes.',
      'Beware of unauthorized priests or donation agents; use the official Kashi Vishwanath temple counter for darshan tickets.'
    ],
    itinerary1Day: 'Dawn: Sunrise boat ride from Assi Ghat -> Morning: Kashi Vishwanath darshan -> Afternoon: Sarnath excursion -> Evening: Grand Ganga Aarti.',
  },

  // HIMACHAL (MANALI & SHIMLA)
  manali: {
    name: 'Manali & Shimla',
    region: 'Himachal Pradesh (Himalayas)',
    tagline: 'Snow-Capped Peaks, Apple Orchards, Adventure Sports & Pine Forests',
    bestTime: 'April to June (Summer escapes) | December to February (For snow & skiing)',
    topAttractions: [
      { name: 'Solang Valley & Atal Tunnel', desc: 'Adventure haven for paragliding, zorbing, skiing, and gateway through the world\'s longest high-altitude highway tunnel.' },
      { name: 'Rohtang Pass (3,978m)', desc: 'Spectacular snow-covered pass connecting Kullu with Lahaul and Spiti valleys.' },
      { name: 'Hadimba Devi Temple', desc: '16th-century four-tier wooden pagoda temple nestled inside tranquil cedar deodar forests.' },
      { name: 'Old Manali & Mall Road', desc: 'Cozy cafes, wooden handicrafts, woolen shawls, and vibrant backpacker culture.' },
      { name: 'Shimla Ridge & Mall Road', desc: 'Colonial heritage promenade, Christ Church, and the Jakhoo Hanuman Temple.' }
    ],
    famousFood: 'Siddu with ghee, Trout fish, Dham traditional festive feast, Kullu apples, Maggi and hot tea at high passes.',
    safetyTips: [
      '⚠️ High Altitude Acclimatization: Drink plenty of water at Rohtang Pass; avoid strenuous running.',
      'Winter driving: Only 4x4 vehicles with tire chains permitted on icy stretches.',
      'Rohtang Pass requires online green permits in advance.'
    ],
    itinerary1Day: 'Morning: Hadimba Temple & Old Manali -> Midday: Solang Valley adventure -> Afternoon: Atal Tunnel -> Evening: Mall Road shopping.',
  },

  // KASHMIR & LADAKH
  kashmir: {
    name: 'Kashmir & Ladakh',
    region: 'Northern Himalayas',
    tagline: 'Paradise on Earth: Pristine Lakes, Snow Valleys & High Passes',
    bestTime: 'April to October (Lush flowers & pleasant weather) | Dec to Feb (Snow lovers in Gulmarg)',
    topAttractions: [
      { name: 'Dal Lake & Houseboats (Srinagar)', desc: 'Stay in ornate carved walnut-wood houseboats and ride wooden Shikaras through floating vegetable markets.' },
      { name: 'Gulmarg Gondola & Apharwat Peak', desc: 'World\'s second-highest operating cable car taking visitors to 4,000m snow slopes.' },
      { name: 'Pahalgam (Valley of Shepherds)', desc: 'Breathtaking Betaab Valley, Aru Valley, and the gushing Lidder River.' },
      { name: 'Pangong Tso & Nubra Valley (Ladakh)', desc: 'Color-changing high-altitude saltwater lake and white sand dunes with double-humped Bactrian camels.' }
    ],
    famousFood: 'Wazwan feast (Rogan Josh, Rista, Gushtaba), Kahwa saffron tea with almonds, Kashmiri Pulao.',
    safetyTips: [
      'Ladakh Acclimatization: Strictly rest for the first 24-48 hours in Leh before traveling to Nubra or Pangong to prevent Acute Mountain Sickness (AMS).',
      'Prepaid SIM cards from outside J&K do not work in Kashmir/Ladakh; buy a local postpaid SIM or BSNL/Airtel/Jio.'
    ],
    itinerary1Day: 'Morning: Dal Lake Shikara ride -> Midday: Mughal Gardens (Nishat & Shalimar) -> Afternoon: Shankaracharya Temple view.',
  },

  // DUBAI (International)
  dubai: {
    name: 'Dubai',
    region: 'United Arab Emirates (UAE)',
    tagline: 'Futuristic Skyscrapers, Desert Safaris, Luxury Shopping & Modern Wonders',
    bestTime: 'November to March (Pleasant outdoor weather)',
    topAttractions: [
      { name: 'Burj Khalifa', desc: 'World\'s tallest building (828m) with observation decks on the 124th, 125th, and 148th floors.' },
      { name: 'The Dubai Mall & Dubai Fountain', desc: 'World\'s largest destination for shopping, entertainment, and synchronized fountain water shows.' },
      { name: 'Desert Safari & Dune Bashing', desc: '4x4 desert ride, sandboarding, camel rides, and traditional Arabian BBQ camp dinner.' },
      { name: 'Museum of the Future', desc: 'Architectural masterpiece ring-shaped calligraphy building showcasing future technology.' },
      { name: 'Palm Jumeirah & Atlantis Aquaventure', desc: 'Iconic man-made palm archipelago featuring luxury resorts and world-class waterparks.' }
    ],
    famousFood: 'Shawarma, Al Harees, Mandi, Luqaimat sweet dumplings, Arabic Mezze, Karak Chai.',
    safetyTips: [
      'Dubai is one of the safest cities in the world with strict law enforcement.',
      'Metro: Fully automated, efficient transit connecting DXB airport to main tourist areas.',
      'Emergency Helpline: 999 (Police) | 998 (Ambulance).'
    ],
    itinerary1Day: 'Morning: Museum of the Future -> Afternoon: Dubai Mall & Burj Khalifa -> Evening: Dubai Fountain & Marina walk.',
  },

  // PARIS (International)
  paris: {
    name: 'Paris',
    region: 'France (City of Light & Art)',
    tagline: 'World-Renowned Art, Fashion, Gastronomy, Architecture & Romance',
    bestTime: 'April to October (Spring blooms and pleasant summer walks)',
    topAttractions: [
      { name: 'The Eiffel Tower', desc: 'Global cultural icon offering panoramic views of Paris from its three observation levels.' },
      { name: 'Louvre Museum', desc: 'World\'s largest art museum housing the Mona Lisa, Venus de Milo, and Winged Victory.' },
      { name: 'Notre-Dame Cathedral & Seine River', desc: 'Masterpiece of French Gothic architecture and evening river cruises passing illuminated bridges.' },
      { name: 'Arc de Triomphe & Champs-Élysées', desc: 'Monumental triumphal arch anchoring the world\'s most famous shopping avenue.' },
      { name: 'Montmartre & Sacré-Cœur Basilica', desc: 'Historic hilltop artistic quarter with cobblestone alleys and panoramic city views.' }
    ],
    famousFood: 'Fresh Croissants, Baguettes, Macarons (Laduree), Crêpes, Escargot, French Cheese & Wine.',
    safetyTips: [
      'Watch out for pickpockets at tourist crowds around the Eiffel Tower, Louvre, and Metro stations.',
      'Paris Metro (RATP) is the fastest way to get anywhere in the city.'
    ],
    itinerary1Day: 'Morning: Louvre Museum -> Afternoon: Seine river stroll & Notre-Dame -> Evening: Eiffel Tower summit & sparkling lights.',
  }
};

/**
 * Searches the city guides dictionary for a match based on user query
 */
function findCityGuide(query = '') {
  const q = String(query || '').toLowerCase().trim();

  // Aliases and region maps
  const aliasMap = {
    'goa': 'goa',
    'panaji': 'goa',
    'calangute': 'goa',
    'baga': 'goa',
    'anjuna': 'goa',
    'palolem': 'goa',
    'dudhsagar': 'goa',
    'mumbai': 'mumbai',
    'bombay': 'mumbai',
    'bengaluru': 'bengaluru',
    'bangalore': 'bengaluru',
    'mysuru': 'mysuru',
    'mysore': 'mysuru',
    'belagavi': 'belagavi',
    'belgaum': 'belagavi',
    'gokak': 'belagavi',
    'hampi': 'hampi',
    'badami': 'badami',
    'pattadakal': 'badami',
    'aihole': 'badami',
    'coorg': 'coorg',
    'madikeri': 'coorg',
    'gokarna': 'gokarna',
    'delhi': 'delhi',
    'agra': 'agra',
    'taj mahal': 'agra',
    'jaipur': 'jaipur',
    'rajasthan': 'jaipur',
    'kerala': 'kerala',
    'kochi': 'kerala',
    'munnar': 'kerala',
    'alleppey': 'kerala',
    'wayanad': 'kerala',
    'hyderabad': 'hyderabad',
    'varanasi': 'varanasi',
    'kashi': 'varanasi',
    'manali': 'manali',
    'shimla': 'manali',
    'kashmir': 'kashmir',
    'srinagar': 'kashmir',
    'ladakh': 'kashmir',
    'dubai': 'dubai',
    'paris': 'paris',
  };

  for (const [key, cityKey] of Object.entries(aliasMap)) {
    // Check if query contains city keyword
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(q)) {
      return CITY_GUIDES[cityKey];
    }
  }

  return null;
}

/**
 * Format a rich, comprehensive guide report in clean Markdown
 */
function formatCityGuideReport(guide, userQuery = '') {
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

  markdown += `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n`;
  markdown += `[SUGGESTIONS: What is the distance to ${guide.name}? | What are famous foods in ${guide.name}? | Plan a safe 2-day itinerary for ${guide.name}]`;

  return markdown;
}

/**
 * Dynamic tourism guide generator for any place not in the static map
 */
function generateDynamicTourismGuide(placeName) {
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
    `- 📞 **Emergency Helplines:** Dial **112 (National Emergency Helpline)** for immediate 24/7 Police, Ambulance, or Fire assistance.\n\n` +
    `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
    `[SUGGESTIONS: What is the distance between Belagavi and ${p}? | Where is the nearest hospital & police? | What are safe travel tips?]`;
}

module.exports = {
  CITY_GUIDES,
  findCityGuide,
  formatCityGuideReport,
  generateDynamicTourismGuide,
};

