const { buildGeminiPrompt } = require('./ragService');

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

/**
 * Generate AI safety response using Gemini with automatic model failover & local safety fallback
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
  let modelUsed = 'local-fallback';

  if (apiKey) {
    // Build Gemini contents payload with history if available
    const contents = [];

    // Add recent history if provided
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

    // Try candidate models in order
    for (const model of CANDIDATE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: fullSystemInstruction }],
            },
            contents,
            generationConfig: {
              temperature: 0.25,
              topP: 0.9,
              maxOutputTokens: 1200,
            },
          }),
        });

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
        } else if (data?.error) {
          console.warn(`Gemini model ${model} error:`, data.error.message || data.error);
        }
      } catch (err) {
        console.warn(`Gemini model ${model} network error:`, err.message);
      }
    }
  }

  // If Gemini was unreachable or returned empty, use our smart Rule-Based RAG Fallback
  if (!rawText) {
    rawText = generateSmartLocalFallback(queryStr, safeContext);
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

  // Default suggested questions if none parsed
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
 * Smart Local RAG Fallback when Gemini API is busy or offline
 */
function generateSmartLocalFallback(query = '', context = {}) {
  const safeContext = context || {};
  const q = String(query || '').toLowerCase().trim();
  const { currentZone, nearestHospital, nearestPolice, nearestPharmacy } = safeContext;
  const retrievedDestinations = Array.isArray(safeContext.retrievedDestinations)
    ? safeContext.retrievedDestinations
    : [];

  const formatDist = (item) => {
    if (!item) return 'Nearby';
    const raw = String(item.formattedDistance || item.distanceFormatted || '').trim();
    if (!raw) return 'Nearby';
    return raw.toLowerCase().endsWith('away') ? raw : `${raw} away`;
  };

  const policeDist = formatDist(nearestPolice);
  const hospDist = formatDist(nearestHospital);
  const pharmDist = formatDist(nearestPharmacy);

  // Friendly Greeting
  const isGreeting = /^(hi|hello|hey|namaste|vanakkam|good\s*(morning|afternoon|evening)|howdy)\b/i.test(q);
  if (isGreeting && q.split(/\s+/).length <= 4) {
    return `### 🤖 Welcome to Raksha Setu AI Tourist Assistant\n\n` +
      `Hello! I am your 24/7 Smart Safety Companion for your trip in Karnataka.\n\n` +
      `**Current Safety Overview:**\n` +
      `- 🛡️ **Status:** Active in Verified Safe Corridor\n` +
      `- 🚓 **Nearest Police:** ${nearestPolice ? nearestPolice.name : 'Udyambag Police Station'} (${policeDist})\n` +
      `- 🏥 **Nearest Hospital:** ${nearestHospital ? nearestHospital.name : 'Udyambag Multispeciality Hospital'} (${hospDist})\n` +
      `- 💊 **Nearest Medical Shop:** ${nearestPharmacy ? nearestPharmacy.name : 'Sanjeevani Medical Stores'} (${pharmDist})\n\n` +
      `How can I assist you today? Feel free to ask about nearby attractions, hospital/police routes, or safety advice.\n\n` +
      `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: Is my current location safe? | Show me nearby tourist attractions | Where is the nearest hospital & police?]`;
  }

  if (q.includes('safe') || q.includes('zone') || q.includes('location')) {
    let zoneDesc = currentZone
      ? `You are inside **${currentZone.name}** (Category: **${String(currentZone.zoneType || 'safe').toUpperCase()}**). ${currentZone.description || ''}`
      : `You are currently in a **Verified Safe Green Corridor** with active police patrolling.`;

    return `### 🛡️ Real-Time Safety Assessment\n\n${zoneDesc}\n\n` +
      `**Your Emergency Coordinates & Telemetry:**\n` +
      `- 🚓 **Nearest Police Station:** ${nearestPolice ? nearestPolice.name : 'Udyambag Police Station'} (${policeDist})\n` +
      `- 🏥 **Nearest Hospital:** ${nearestHospital ? nearestHospital.name : 'Udyambag Multispeciality Hospital'} (${hospDist})\n` +
      `- 💊 **Nearest Medical Shop:** ${nearestPharmacy ? nearestPharmacy.name : 'Sanjeevani Medical Stores'} (${pharmDist})\n` +
      `- 📞 **Emergency Helpline:** 112 (Police) | 108 (Ambulance)\n\n` +
      `Stay alert and keep location sharing active in Raksha Setu.\n\n` +
      `[ACTIONS: OPEN_RADAR, CALL_112, OPEN_VOICE_BOARD]\n` +
      `[SUGGESTIONS: Where is the nearest hospital? | Where is the nearest medical shop? | Where is the nearest police station?]`;
  }

  // Dedicated Medical Shop / Pharmacy Query
  if (q.includes('pharmacy') || q.includes('medical shop') || q.includes('medical store') || q.includes('medicine') || q.includes('chemist') || q.includes('drug store')) {
    return `### 💊 Nearest Medical Shop / Pharmacy\n\n` +
      `The closest verified pharmacy to your live location is **${nearestPharmacy ? nearestPharmacy.name : 'Sanjeevani Medical & General Stores'}**.\n\n` +
      `- **Distance:** ${pharmDist}\n` +
      `- **Contact Phone:** ${nearestPharmacy ? nearestPharmacy.phone : '0831 240 5210'}\n` +
      `- **Operating Status:** 24/7 Verified\n` +
      `- **Address:** ${nearestPharmacy ? nearestPharmacy.address : 'Khanapur Road, Near 3rd Cross, Industrial Area, Udyambag, Belagavi'}\n\n` +
      `Tap below to open radar navigation or call ahead for emergency medication.\n\n` +
      `[ACTIONS: OPEN_RADAR, CALL_108]\n` +
      `[SUGGESTIONS: Where is the nearest hospital? | Where is the nearest police station? | Is my current location safe?]`;
  }

  if (q.includes('safe route') || q.includes('route') || q.includes('direction') || q.includes('corridor') || q.includes('detour') || q.includes('safe way')) {
    return `### 🛡️ Safe Route Recommendation\n\n` +
      `Your route is actively monitored and verified under **RakshaSetu Safe Green Corridor**:\n\n` +
      `- 🛣️ **Recommended Arterial Corridors:** Stick to primary well-lit arterial roads (Khanapur Road, Congress Road, College Road).\n` +
      `- 🚫 **Hazard Avoidance:** Active restricted and high-risk geofence zones are automatically detoured.\n` +
      `- 🚓 **Patrol Protection:** Belagavi City Police PCR vehicles actively patrol these main corridors.\n` +
      `- 📍 **Turn-by-Turn Safe Navigation:** Tap the **Navigate** button on any nearby Safe Haven in your mobile app to launch live turn-by-turn guidance with hazard bypass.\n\n` +
      `[ACTIONS: OPEN_RADAR]\n` +
      `[SUGGESTIONS: Where is the nearest hospital? | Where is the nearest police station? | Is my current location safe?]`;
  }

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

  // Tourist destination query
  const isTourismQuery = /touris|attract|place|visit|sight|fort|falls|temple|hampi|gokak|badami|monument/i.test(q);
  if (isTourismQuery && retrievedDestinations.length > 0) {
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

  return `### 🤖 Raksha Setu AI Tourist Assistant\n\n` +
    `Hello! I am your 24/7 Smart Tourist Safety Assistant.\n\n` +
    `I can help you with:\n` +
    `- **Real-time Safety Assessment** of your current location.\n` +
    `- **Finding Safe Havens:** Police stations, 24/7 hospitals, and pharmacies.\n` +
    `- **Tourist Guidance:** Belagavi Fort, Gokak Falls, Hampi UNESCO site, Badami caves, and more.\n` +
    `- **Emergency SOS:** Direct distress dispatch and 112 helpline.\n\n` +
    `What would you like to explore or check?\n\n` +
    `[ACTIONS: OPEN_RADAR, OPEN_VOICE_BOARD]\n` +
    `[SUGGESTIONS: Is my current location safe? | Where is the nearest hospital & police? | Top attractions near me]`;
}

module.exports = {
  generateSafetyResponse,
  generateSmartLocalFallback,
  parseResponseTags,
};

