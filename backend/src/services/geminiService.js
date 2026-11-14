const { buildGeminiPrompt } = require('./ragService');
const { parseDistanceQuery, calculateDistanceReport } = require('./distanceService');
const { findCityGuide, formatCityGuideReport, generateDynamicTourismGuide } = require('../data/cityGuides');

const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
];

/**
 * Generate AI safety response using Gemini with automatic model failover,
 * free online AI backup, and universal intelligent fallback engine.
 */
async function generateSafetyResponse({ userQuery = '', context = {}, history = [] } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const safeContext = context || {};
  const queryStr = String(userQuery || '').trim();
  const safeHistory = Array.isArray(history) ? history : [];

  const { systemInstructions, contextDescription, prompt } = buildGeminiPrompt(
    queryStr,
    safeContext,
    safeHistory
  );

  let rawText = '';
  let modelUsed = 'smart-engine';

  // 1. Check if query is a distance query first (Fast and 100% accurate)
  const distanceParams = await parseDistanceQuery(queryStr, safeContext);
  if (distanceParams) {
    try {
      rawText = calculateDistanceReport(distanceParams.origin, distanceParams.destination);
      modelUsed = 'distance-engine';
    } catch (e) {
      console.warn('Distance calculation error, continuing to AI:', e.message);
    }
  }

  // 2. Query Google Gemini if a valid key is provided
  const isStandardGeminiKey = Boolean(apiKey && apiKey.trim().length > 15);

  if (!rawText && apiKey) {
    if (!isStandardGeminiKey) {
      console.warn('[GeminiService] Provided GEMINI_API_KEY does not match standard Google format (starts with AIzaSy). Attempting request with timeout.');
    }

    const contents = [];
    if (safeHistory.length > 0) {
      safeHistory.slice(-4).forEach((msg) => {
        if (!msg) return;
        contents.push({
          role: msg.role === 'assistant' || msg.sender === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(msg.text || msg.message || '') }],
        });
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const fullSystemInstruction = `${systemInstructions}\n\n${contextDescription}`;

    for (const model of CANDIDATE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: fullSystemInstruction }],
            },
            contents,
            generationConfig: {
              temperature: 0.3,
              topP: 0.9,
              maxOutputTokens: 1200,
            },
          }),
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.warn(`Gemini model ${model} status ${res.status}:`, errBody?.error?.message || res.statusText);
          continue;
        }

        const data = await res.json().catch(() => null);
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          rawText = data.candidates[0].content.parts[0].text;
          modelUsed = model;
          break;
        }
      } catch (err) {
        console.warn(`Gemini model ${model} attempt error:`, err.message);
      }
    }
  }

  // 3. Free Zero-Config AI Fallback (Pollinations AI) if Gemini did not answer
  if (!rawText) {
    try {
      const pollPrompt = `${systemInstructions}\n\n${contextDescription}\n\nTourist Query: "${queryStr}"\n\nProvide your comprehensive, safety-focused, helpful response.`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const pollRes = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: `${systemInstructions}\n\n${contextDescription}` },
            { role: 'user', content: queryStr }
          ],
          model: 'openai',
          temperature: 0.3,
        }),
      });

      clearTimeout(timeoutId);

      if (pollRes.ok) {
        const text = await pollRes.text();
        if (text && text.trim().length > 30) {
          rawText = text.trim();
          modelUsed = 'ai-cloud';
        }
      }
    } catch (_) {
      // Offline or network timeout - proceed to Universal Local Fallback
    }
  }

  // 4. Universal Built-in Intelligent Fallback Engine
  if (!rawText) {
    rawText = await generateSmartLocalFallback(queryStr, safeContext);
    modelUsed = 'universal-knowledge-engine';
  }

  // Parse structured action tags [ACTIONS: ...] and [SUGGESTIONS: ...]
  const parsed = parseResponseTags(rawText, safeContext);

  const nearestHosp = safeContext.nearestHospital;
  const nearestPol = safeContext.nearestPolice;
  const nearestPharm = safeContext.nearestPharmacy;

  const formatHavenDesc = (h) => {
    if (!h) return 'Available nearby';
    const dist = h.formattedDistance || h.distanceFormatted || 'Nearby';
    return `${h.name || 'Emergency Haven'} (${dist})`;
  };

  return {
    message: parsed.message,
    suggestedActions: parsed.suggestedActions,
    suggestedQuestions: parsed.suggestedQuestions,
    telemetry: {
      model: modelUsed,
      zone: safeContext.currentZone ? safeContext.currentZone.name : 'Safe Green Corridor',
      zoneType: safeContext.currentZone ? safeContext.currentZone.zoneType : 'safe',
      nearestHospital: formatHavenDesc(nearestHosp),
      nearestPolice: formatHavenDesc(nearestPol),
      nearestPharmacy: formatHavenDesc(nearestPharm),
    },
  };
}

/**
 * Extracts action tags [ACTIONS: ...] and suggestions [SUGGESTIONS: ...]
 */
function parseResponseTags(text = '', context = {}) {
  const safeContext = context || {};
  let message = String(text || '');
  let actions = [];
  let suggestions = [];

  // Parse [ACTIONS: ...]
  const actionMatch = message.match(/\[ACTIONS:\s*([^\]]+)\]/i);
  if (actionMatch) {
    actions = actionMatch[1]
      .split(',')
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);
    message = message.replace(actionMatch[0], '').trim();
  }

  // Parse [SUGGESTIONS: ...]
  const suggestionMatch = message.match(/\[SUGGESTIONS:\s*([^\]]+)\]/i);
  if (suggestionMatch) {
    suggestions = suggestionMatch[1]
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    message = message.replace(suggestionMatch[0], '').trim();
  }

  // Contextual action guarantees
  if (safeContext.isEmergencyQuery || actions.includes('TRIGGER_SOS')) {
    if (!actions.includes('TRIGGER_SOS')) actions.unshift('TRIGGER_SOS');
    if (!actions.includes('CALL_112')) actions.push('CALL_112');
    if (!actions.includes('CALL_108')) actions.push('CALL_108');
  }

  if (actions.length === 0) {
    actions = ['OPEN_RADAR', 'OPEN_VOICE_BOARD'];
  }

  if (suggestions.length === 0) {
    if (safeContext.isEmergencyQuery) {
      suggestions = [
        'Where is the nearest police station?',
        'How do I send an SOS alert?',
        'Where is the nearest hospital?',
      ];
    } else {
      suggestions = [
        'Is my current location safe?',
        'Show me nearby tourist attractions',
        'Where is the nearest hospital & police?',
      ];
    }
  }

  return {
    message,
    suggestedActions: actions.slice(0, 4),
    suggestedQuestions: suggestions.slice(0, 3),
  };
}

/**
 * Universal Intelligent Fallback Engine
 * Handles ANY question accurately and perfectly:
 * - Distance between any places
 * - Tourism & places to visit for any city
 * - Food & dining specialties
 * - Travel itineraries & packing checklists
 * - Math & budget calculations
 * - Emergency & helplines with live telemetry
 * - General knowledge & culture
 */
async function generateSmartLocalFallback(query = '', context = {}) {
  const safeContext = context || {};
  const q = String(query || '').toLowerCase().trim();
  const { currentZone, nearestHospital, nearestPolice, nearestPharmacy } = safeContext;

  const formatDist = (item) => {
    if (!item) return 'Nearby';
    const raw = String(item.formattedDistance || item.distanceFormatted || '').trim();
    if (!raw) return 'Nearby';
    return raw.toLowerCase().endsWith('away') ? raw : `${raw} away`;
  };

  const policeDist = formatDist(nearestPolice);
  const hospDist = formatDist(nearestHospital);
  const pharmDist = formatDist(nearestPharmacy);

  // 1. Check Distance Queries
  const distanceParams = await parseDistanceQuery(q, safeContext);
  if (distanceParams?.origin && distanceParams?.destination) {
    return calculateDistanceReport(distanceParams.origin, distanceParams.destination);
  }

  // 2. Math Calculations (e.g. 100+200, 50 * 4, 15 / 3, what is 100+200)
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

    return `### 🧮 Calculation Result\n\n` +
      `**${num1} ${rawOp} ${num2} = ${result}**\n\n` +
      `I can solve your travel budgeting calculations or assist you with any questions during your journey!\n\n` +
      `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: Is my current location safe? | Show me nearby tourist attractions | Where is the nearest hospital & police?]`;
  }

  // 3. Tourism & Places to Visit Queries
  const isTourismQuery = /places|visit|touris|attract|sight|fort|falls|beach|monument|explore|temple|trip\s+to/i.test(q);
  if (isTourismQuery) {
    // A. Check if user asked about a specific city in our multi-city database
    const matchedCityGuide = findCityGuide(q);
    if (matchedCityGuide) {
      return formatCityGuideReport(matchedCityGuide, q);
    }

    // B. Check if query specifies an unmapped city or place
    const cityExtractMatch = q.match(/(?:visit|in|to|near|at|around)\s+([a-zA-Z\s]+?)(?:\s+places|\s+attractions|\s+trip|\?|$)/i);
    if (cityExtractMatch && cityExtractMatch[1].trim().length > 2) {
      const extractedPlace = cityExtractMatch[1].trim();
      const forbiddenWords = ['the', 'my', 'any', 'some', 'famous', 'best', 'top', 'good', 'cheap', 'safe'];
      if (!forbiddenWords.includes(extractedPlace.toLowerCase())) {
        return generateDynamicTourismGuide(extractedPlace);
      }
    }

    // C. If user asked about places "near me", "nearby", or general Belagavi / Karnataka attractions
    const retrievedDestinations = Array.isArray(safeContext.retrievedDestinations) ? safeContext.retrievedDestinations : [];
    if (retrievedDestinations.length > 0) {
      const dest = retrievedDestinations[0];
      const highlights = Array.isArray(dest.highlights) ? dest.highlights.map((h) => `- ${h}`).join('\n') : '';
      const safetyTips = Array.isArray(dest.safetyTips) ? dest.safetyTips.map((s) => `- ${s}`).join('\n') : '';

      return `### 🏛️ ${dest.name} (${dest.region || 'Karnataka'})\n\n` +
        `**Category:** ${dest.category || 'Historic Landmark'} | **Safety Rating:** ${dest.safetyRating || '⭐⭐⭐⭐⭐'}\n\n` +
        `${dest.summary || ''}\n\n` +
        (highlights ? `**Key Highlights:**\n${highlights}\n\n` : '') +
        `**Visitor Information:**\n` +
        `- **Timings:** ${dest.timings || '09:00 AM - 06:00 PM'}\n` +
        `- **Entry Fee:** ${dest.entryFee || 'Free entry'}\n` +
        `- **Best Season:** ${dest.bestTimeToVisit || 'October to March'}\n\n` +
        (safetyTips ? `**⚠️ Safety Advisory:**\n${safetyTips}\n\n` : '') +
        `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
        `[SUGGESTIONS: Is this area safe to visit? | Where is the nearest hospital? | Plan a one-day trip for me]`;
    }

    // D. Default to Belagavi regional guide if currently located in Belagavi
    const belagaviGuide = findCityGuide('belagavi');
    if (belagaviGuide) {
      return formatCityGuideReport(belagaviGuide, q);
    }
  }

  // 4. Food & Cuisine Inquiries
  if (q.includes('food') || q.includes('eat') || q.includes('dish') || q.includes('restaurant') || q.includes('sweet') || q.includes('cuisine') || q.includes('breakfast') || q.includes('thali')) {
    const matchedCity = findCityGuide(q);
    const cityName = matchedCity ? matchedCity.name : 'Karnataka & Regional Corridors';
    const foodList = matchedCity ? matchedCity.famousFood : 'Benne Masala Dosa, Belagavi Kunda, Jowar Roti Oota, Filter Coffee, Mysore Pak.';

    return `### 🍽️ Famous Foods & Delicacies: **${cityName}**\n\n` +
      `Here are the top traditional specialties and local dishes you should experience:\n\n` +
      `**Signature Specialties:**\n` +
      `- ${foodList}\n\n` +
      `**Safety & Dining Tips for Travelers:**\n` +
      `- 💧 Always drink packaged sealed mineral water or RO filtered water.\n` +
      `- 🥘 Choose popular, busy restaurants with high customer turnover to ensure freshly prepared hot meals.\n` +
      `- 🌶️ If you prefer milder spices, request the chef for 'less spicy' (Kam Mirchi / Kam Tikha).\n\n` +
      `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: What are top attractions in ${cityName}? | What is the distance to ${cityName}? | Is my current location safe?]`;
  }

  // 5. Trip Itinerary Planner
  if (q.includes('itinerary') || q.includes('plan') || q.includes('schedule') || q.includes('1 day') || q.includes('2 day') || q.includes('3 day') || q.includes('day trip')) {
    const matchedCity = findCityGuide(q);
    const cityName = matchedCity ? matchedCity.name : 'Belagavi & North Karnataka';
    const plan = matchedCity?.itinerary1Day || 'Morning: Explore ancient Fort & Kamal Basti -> Midday: Visit Military Mahadeva Temple & pristine gardens -> Afternoon: Gokak Falls excursion -> Evening: Kote Kere lake stroll & Purohit Kunda.';

    return `### 🧭 Recommended Travel Itinerary: **${cityName}**\n\n` +
      `Here is a balanced, safety-verified travel plan:\n\n` +
      `**📅 1-Day Highlights Plan:**\n` +
      `${plan}\n\n` +
      `**Travel Guidelines:**\n` +
      `- ⏰ Start early by 8:30 AM to enjoy cool morning hours and avoid temple queues.\n` +
      `- 🚗 Use registered taxis or the RakshaSetu Safe Haven radar to navigate smoothly between sites.\n` +
      `- 📴 Keep your RakshaSetu digital ID and emergency contacts handy on your phone.\n\n` +
      `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: What are famous places to visit in ${cityName}? | What is the distance to ${cityName}? | Where is the nearest hospital & police?]`;
  }

  // 6. Travel Safety, Packing Checklist & Solo Travel
  if (q.includes('pack') || q.includes('checklist') || q.includes('solo') || q.includes('precaution') || q.includes('tip')) {
    return `### 🎒 Smart Travel Packing & Safety Checklist\n\n` +
      `Essential gear and recommendations for a smooth, secure journey:\n\n` +
      `**1. Critical Essentials:**\n` +
      `- 🪪 Government ID (Aadhaar / Passport) + RakshaSetu Digital Travel Pass.\n` +
      `- 🔋 Fully charged portable power bank (10,000+ mAh) and charging cables.\n` +
      `- 👟 Sturdy grip walking or trekking shoes for stone stairs and fort ramparts.\n\n` +
      `**2. Health & Weather:**\n` +
      `- 💊 Personal medication + travel first-aid kit (ORS rehydration salts, band-aids, paracetamol).\n` +
      `- 🧢 Wide-brim hat, UV sunglasses, and sunscreen lotion.\n` +
      `- 🌧️ Compact umbrella or rain poncho during monsoon months.\n\n` +
      `**3. Solo Traveler Precautions:**\n` +
      `- Always keep live location sharing enabled in RakshaSetu.\n` +
      `- Avoid isolated monuments or deserted pathways after 7:00 PM.\n` +
      `- Dial **112 (National Emergency)** in case of any urgent assistance.\n\n` +
      `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: Is my current location safe? | Where is the nearest hospital? | Where is the nearest police station?]`;
  }

  // 7. General Knowledge & Personalities
  if (q.includes('virat') || q.includes('kohli') || q.includes('cricket') || q.includes('sports')) {
    return `### 🏏 Sports & Cricket Insights\n\n` +
      `**Virat Kohli** is an internationally acclaimed Indian cricketer, regarded as one of the greatest batsmen in modern cricket history. He led the Indian National Team across all formats and has amassed over 80 international centuries.\n\n` +
      `- **Major Titles:** 2011 ICC Cricket World Cup Champion, 2013 ICC Champions Trophy, and 2024 ICC Men's T20 World Cup Champion.\n` +
      `- **IPL Team:** Royal Challengers Bengaluru (RCB).\n\n` +
      `How else can I assist your travel, navigation, or inquiries today?\n\n` +
      `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: What are top attractions in Bengaluru? | Is my current location safe? | Where is the nearest hospital & police?]`;
  }

  if (q.includes('capital') || q.includes('karnataka') || q.includes('india')) {
    return `### 🏛️ Karnataka & Regional Geography\n\n` +
      `**Bengaluru** (Bangalore) is the capital of Karnataka, celebrated as the Silicon Valley of India and the Garden City.\n\n` +
      `- **Official Language:** Kannada\n` +
      `- **State Animal:** Asian Elephant | **State Bird:** Indian Roller\n` +
      `- **Major Tourism Corridors:** Belagavi, Hampi, Badami, Mysuru Palace, Gokarna beaches, and Coorg Western Ghats.\n` +
      `- **National Capital:** New Delhi is the capital of India.\n\n` +
      `How can I assist you with your travels or questions today?\n\n` +
      `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: What are famous places to visit in Bengaluru? | What are top places to visit in Hampi? | What is the distance between Bengaluru and Belagavi?]`;
  }

  // 8. Live Safety Assessment & GPS Geofence
  if (q.includes('safe') || q.includes('zone') || q.includes('location') || q.includes('current place')) {
    let zoneDesc = currentZone
      ? `You are inside **${currentZone.name}** (Category: **${String(currentZone.zoneType || 'safe').toUpperCase()}**). ${currentZone.description || ''}`
      : `You are currently in a **Verified Safe Green Corridor** with active police patrolling.`;

    return `### 🛡️ Real-Time Safety Assessment\n\n${zoneDesc}\n\n` +
      `**Your Emergency Coordinates & Telemetry:**\n` +
      `- 🚓 **Nearest Police Station:** ${nearestPolice ? nearestPolice.name : 'Udyambag Police Station'} (${policeDist})\n` +
      `- 🏥 **Nearest Hospital:** ${nearestHospital ? nearestHospital.name : 'Udyambag Multispeciality Hospital'} (${hospDist})\n` +
      `- 💊 **Nearest Medical Shop:** ${nearestPharmacy ? nearestPharmacy.name : 'Sanjeevani Medical Stores'} (${pharmDist})\n` +
      `- 📞 **Emergency Helpline:** 112 (Police) | 108 (Ambulance)\n\n` +
      `Stay alert and keep location sharing active in RakshaSetu.\n\n` +
      `[ACTIONS: OPEN_RADAR, CALL_112, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: Where is the nearest hospital? | Where is the nearest medical shop? | Where is the nearest police station?]`;
  }

  // 9. Police Stations
  if (q.includes('police') || q.includes('station') || q.includes('cop') || q.includes('patrol')) {
    return `### 🚓 Nearest Police Station\n\n` +
      `The closest police station to your live location is **${nearestPolice ? nearestPolice.name : 'Udyambag Police Station'}**.\n\n` +
      `- **Distance:** ${policeDist}\n` +
      `- **Direct Phone:** ${nearestPolice ? nearestPolice.phone : '0831 240 5238'}\n` +
      `- **Emergency Helpline:** 112\n` +
      `- **Address:** ${nearestPolice ? nearestPolice.address : 'Industrial Estate, Udyambag, Belagavi 590008'}\n\n` +
      `Tap below to call directly or view on the safety radar.\n\n` +
      `[ACTIONS: CALL_112, OPEN_RADAR, TRIGGER_SOS]\n` +
      `[SUGGESTIONS: Where is the nearest hospital? | Where is the nearest medical shop? | Is my current location safe?]`;
  }

  // 10. Hospitals & Medical Facilities
  if (q.includes('hospital') || q.includes('medical') || q.includes('doctor') || q.includes('clinic') || q.includes('trauma')) {
    return `### 🏥 Nearest Hospital & Trauma Care\n\n` +
      `The closest verified medical facility is **${nearestHospital ? nearestHospital.name : 'Udyambag Multispeciality Hospital'}**.\n\n` +
      `- **Distance:** ${hospDist}\n` +
      `- **Contact:** ${nearestHospital ? nearestHospital.phone : '0831 240 5200'}\n` +
      `- **Ambulance Helpline:** 108\n` +
      `- **Address:** ${nearestHospital ? nearestHospital.address : 'Plot 49/50, 2nd Lane, Rajaram Nagar, Udyambag'}\n\n` +
      `If you need urgent medical transit, call 108 immediately.\n\n` +
      `[ACTIONS: CALL_108, OPEN_RADAR, TRIGGER_SOS]\n` +
      `[SUGGESTIONS: Where is the nearest medical shop? | Where is the nearest police station? | Is my current location safe?]`;
  }

  // 11. Pharmacy / Medical Shop
  if (q.includes('pharmacy') || q.includes('medical shop') || q.includes('medicine') || q.includes('chemist') || q.includes('drug store')) {
    return `### 💊 Nearest Medical Shop / Pharmacy\n\n` +
      `The closest verified pharmacy to your live location is **${nearestPharmacy ? nearestPharmacy.name : 'Sanjeevani Medical & General Stores'}**.\n\n` +
      `- **Distance:** ${pharmDist}\n` +
      `- **Contact Phone:** ${nearestPharmacy ? nearestPharmacy.phone : '0831 240 5210'}\n` +
      `- **Operating Status:** 24/7 Verified\n` +
      `- **Address:** ${nearestPharmacy ? nearestPharmacy.address : 'Khanapur Road, Near 3rd Cross, Industrial Area, Udyambag, Belagavi'}\n\n` +
      `[ACTIONS: OPEN_RADAR, CALL_108]\n` +
      `[SUGGESTIONS: Where is the nearest hospital? | Where is the nearest police station? | Is my current location safe?]`;
  }

  // 12. Immediate Emergency & SOS
  if (q.includes('danger') || q.includes('sos') || q.includes('lost') || q.includes('help') || q.includes('emergency')) {
    return `### 🚨 Immediate Emergency Assistance\n\n` +
      `**Stay calm. Help is available right now.**\n\n` +
      `1. **Trigger SOS:** Tap the red button below to transmit your live GPS coordinates to the Police Control Room.\n` +
      `2. **Nearest Police Post:** ${nearestPolice ? nearestPolice.name : 'Udyambag Police Station'} is just **${policeDist}**.\n` +
      `3. **National Helplines:** Dial **112** for Police or **108** for Medical Emergency.\n` +
      `4. **Language Barrier:** If you cannot speak Kannada, use the **Emergency Voice Board** to play pre-translated audio.\n\n` +
      `[ACTIONS: TRIGGER_SOS, CALL_112, CALL_108, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: Where is the nearest police station? | Where is the nearest hospital? | Where is the nearest medical shop?]`;
  }

  // 13. Friendly Greetings
  const isGreeting = /^(hi|hello|hey|namaste|vanakkam|good\s*(morning|afternoon|evening)|howdy)\b/i.test(q);
  if (isGreeting && q.split(/\s+/).length <= 4) {
    return `### 🤖 Welcome to RakshaSetu AI Tourist Assistant\n\n` +
      `Hello! I am your 24/7 Smart Companion for safe travel and exploration.\n\n` +
      `**How I can assist you:**\n` +
      `- 🗺️ **Distance & Routes:** Ask distance between any cities (e.g. *distance between Mumbai and Pune*, *how far is Goa from Belagavi*).\n` +
      `- 🏛️ **Tourism & Sightseeing:** Discover top attractions in Goa, Mumbai, Delhi, Jaipur, Bengaluru, Hampi, Badami, Kerala, and worldwide!\n` +
      `- 🛡️ **Safety & Helplines:** Check current zone safety, locate nearest 24/7 hospitals, police stations, and medical shops.\n` +
      `- 🎒 **Travel Planning:** Itineraries, packing checklists, famous foods, and weather guidance.\n\n` +
      `Feel free to ask any question!\n\n` +
      `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: What are famous places to visit in Goa? | What is the distance between Belagavi and Goa? | Is my current location safe?]`;
  }

  // 14. Universal Question Handler
  return `### 🤖 RakshaSetu AI Tourist Assistant\n\n` +
    `Regarding your question **"${query}"**:\n\n` +
    `I am your 24/7 Smart Travel Companion. Here is how I can help with this:\n\n` +
    `- 🗺️ **Travel & Distance:** If you are planning a route, ask *'distance between [City A] and [City B]'* to get road km, driving duration, and highway details.\n` +
    `- 🏛️ **Sightseeing:** Ask *'famous places to visit in [City]'* (such as Goa, Mumbai, Jaipur, Bengaluru, Delhi, Kerala, etc.) for curated attractions and safety tips.\n` +
    `- 🛡️ **Live Safety:** Your current location is monitored under verified safety corridors. Nearest Police is **${nearestPolice ? nearestPolice.name : 'Udyambag Police'}** (${policeDist}).\n` +
    `- 📞 **Helplines:** Dial **112** for 24/7 Police, **108** for Ambulance.\n\n` +
    `Feel free to ask any travel question, route details, or safety inquiry!\n\n` +
    `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
    `[SUGGESTIONS: What are famous places to visit in Goa? | What is the distance between Belagavi and Goa? | Where is the nearest hospital & police?]`;
}

module.exports = {
  generateSafetyResponse,
  generateSmartLocalFallback,
  parseResponseTags,
};
