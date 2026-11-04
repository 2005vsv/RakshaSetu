const Zone = require('../models/Zone');
const Incident = require('../models/Incident');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { contains } = require('../utils/polygon');
const {
  VERIFIED_SAFE_HAVENS,
  calculateDistanceMeters,
  formatDistance,
  getSafeHavensForLocation,
} = require('../routes/locations');
const {
  TOURISM_DESTINATIONS,
  EMERGENCY_PROTOCOLS,
  TRAVEL_SAFETY_TIPS,
} = require('../data/tourismKnowledge');

/**
 * Builds real-time grounded context using database, live GPS, and knowledgebase
 */
async function buildTouristContext({ latitude, longitude, userId, query = '' }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasValidGps = Number.isFinite(lat) && Number.isFinite(lng);

  // 1. Check Geofence Zones in MongoDB
  let currentZone = null;
  let allZones = [];
  try {
    allZones = await Zone.find({ is_active: true }).lean();
    if (hasValidGps) {
      for (const zone of allZones) {
        if (zone.geometry && contains([lng, lat], zone.geometry)) {
          currentZone = {
            id: zone._id,
            name: zone.name,
            zoneType: zone.zone_type, // 'safe', 'risky', 'restricted'
            description: zone.description || '',
          };
          break;
        }
      }
    }
  } catch (err) {
    console.warn('Could not query zones:', err.message);
  }

  // 2. Calculate Nearest Safe Havens from GPS (Guaranteed 100% parity with "Find Nearby")
  let sortedHavens = [];
  let nearestHospital = null;
  let nearestPolice = null;
  let nearestPharmacy = null;

  if (hasValidGps) {
    if (typeof getSafeHavensForLocation === 'function') {
      try {
        sortedHavens = await getSafeHavensForLocation(lat, lng, 12, 'all');
      } catch (err) {
        console.warn('RAG getSafeHavensForLocation error, falling back:', err.message);
      }
    }

    if (!sortedHavens || sortedHavens.length === 0) {
      sortedHavens = VERIFIED_SAFE_HAVENS.map((facility) => {
        const distMeters = calculateDistanceMeters(lat, lng, facility.latitude, facility.longitude);
        const fDist = formatDistance(distMeters);
        return {
          ...facility,
          distanceMeters: distMeters,
          distanceKm: Number((distMeters / 1000).toFixed(2)),
          formattedDistance: fDist,
          distanceFormatted: fDist,
        };
      }).sort((a, b) => a.distanceMeters - b.distanceMeters);
    } else {
      // Ensure both formattedDistance and distanceFormatted exist
      sortedHavens = sortedHavens.map((h) => ({
        ...h,
        formattedDistance: h.distanceFormatted || formatDistance(h.distanceMeters),
        distanceFormatted: h.distanceFormatted || formatDistance(h.distanceMeters),
      }));
    }

    nearestHospital = sortedHavens.find((h) => h.type === 'hospital') || null;
    nearestPolice = sortedHavens.find((h) => h.type === 'police') || null;
    nearestPharmacy = sortedHavens.find((h) => h.type === 'pharmacy') || null;
  }

  // 3. User profile & active incident state
  let touristUser = null;
  let activeSos = null;
  if (userId) {
    try {
      touristUser = await User.findById(userId).select('name phone nationality emergencyContacts').lean();
      activeSos = await Incident.findOne({
        tourist: userId,
        status: { $in: ['active', 'investigating', 'assigned'] },
      }).lean();
    } catch (_) { }
  }

  // 4. Recent Announcements
  let recentAnnouncements = [];
  try {
    recentAnnouncements = await Announcement.find({ published: true })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
  } catch (_) { }

  // 5. RAG Document Retrieval based on Query
  const qLower = query.toLowerCase();

  // Search relevant tourist destinations
  const matchedDestinations = TOURISM_DESTINATIONS.filter((dest) => {
    const textToMatch = `${dest.name} ${dest.region} ${dest.category} ${dest.summary}`.toLowerCase();
    const keywords = qLower.split(/\s+/).filter((w) => w.length > 2);
    // If query mentions specific place
    if (keywords.some((k) => textToMatch.includes(k))) return true;
    // If general query asking about places or trip
    if (
      qLower.includes('tourist') ||
      qLower.includes('places') ||
      qLower.includes('visit') ||
      qLower.includes('trip') ||
      qLower.includes('attraction') ||
      qLower.includes('famous') ||
      qLower.includes('itinerary')
    ) {
      return true;
    }
    return false;
  }).slice(0, 4);

  // If none matched but destination requested, return top 3
  const finalDestinations =
    matchedDestinations.length > 0 ? matchedDestinations : TOURISM_DESTINATIONS.slice(0, 3);

  // Match emergency protocols
  let matchedProtocols = [];
  const isEmergencyQuery =
    qLower.includes('danger') ||
    qLower.includes('help') ||
    qLower.includes('sos') ||
    qLower.includes('emergency') ||
    qLower.includes('lost') ||
    qLower.includes('police') ||
    qLower.includes('hospital') ||
    qLower.includes('stuck') ||
    qLower.includes('restricted') ||
    qLower.includes('hurt') ||
    qLower.includes('injured') ||
    qLower.includes('ambulance') ||
    qLower.includes('accident');

  if (isEmergencyQuery) {
    if (qLower.includes('lost')) matchedProtocols.push(EMERGENCY_PROTOCOLS.lostOrStranded);
    if (qLower.includes('medical') || qLower.includes('hurt') || qLower.includes('hospital') || qLower.includes('injured')) {
      matchedProtocols.push(EMERGENCY_PROTOCOLS.medicalEmergency);
    }
    if (qLower.includes('restricted') || qLower.includes('stuck') || qLower.includes('zone')) {
      matchedProtocols.push(EMERGENCY_PROTOCOLS.restrictedZoneAlert);
    }
    matchedProtocols.push(EMERGENCY_PROTOCOLS.generalDistress);
  }

  // Safety tips
  let safetyTips = null;
  if (qLower.includes('tip') || qLower.includes('pack') || qLower.includes('precaution') || qLower.includes('solo') || qLower.includes('family') || qLower.includes('safe')) {
    safetyTips = TRAVEL_SAFETY_TIPS;
  }

  return {
    hasValidGps,
    coords: hasValidGps ? { latitude: lat, longitude: lng } : null,
    currentZone,
    allActiveZonesCount: allZones.length,
    nearestHospital,
    nearestPolice,
    nearestPharmacy,
    topHavens: sortedHavens.slice(0, 4),
    touristUser,
    activeSos: Boolean(activeSos),
    recentAnnouncements,
    retrievedDestinations: finalDestinations,
    matchedProtocols,
    safetyTips,
    isEmergencyQuery,
  };
}

/**
 * Constructs prompt with live context for Gemini
 */
function buildGeminiPrompt(userQuery = '', context = {}, history = []) {
  const safeContext = context || {};
  const hasValidGps = Boolean(safeContext.hasValidGps);
  const coords = safeContext.coords || null;
  const currentZone = safeContext.currentZone || null;
  const nearestHospital = safeContext.nearestHospital || null;
  const nearestPolice = safeContext.nearestPolice || null;
  const nearestPharmacy = safeContext.nearestPharmacy || null;
  const topHavens = Array.isArray(safeContext.topHavens) ? safeContext.topHavens : [];
  const touristUser = safeContext.touristUser || null;
  const activeSos = Boolean(safeContext.activeSos);
  const recentAnnouncements = Array.isArray(safeContext.recentAnnouncements) ? safeContext.recentAnnouncements : [];
  const retrievedDestinations = Array.isArray(safeContext.retrievedDestinations) ? safeContext.retrievedDestinations : [];
  const matchedProtocols = Array.isArray(safeContext.matchedProtocols) ? safeContext.matchedProtocols : [];
  const safetyTips = safeContext.safetyTips || null;

  let contextDescription = `=== LIVE TOURIST & SAFETY TELEMETRY ===\n`;
  if (touristUser) {
    contextDescription += `Tourist Name: ${touristUser.name || 'Valued Visitor'}\n`;
    if (touristUser.nationality) contextDescription += `Nationality: ${touristUser.nationality}\n`;
  }
  if (hasValidGps && coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
    contextDescription += `GPS Coordinates: ${Number(coords.latitude).toFixed(6)}, ${Number(coords.longitude).toFixed(6)} (Belagavi / Udyambag Region)\n`;
  } else {
    contextDescription += `GPS Coordinates: Device acquiring satellite fix (Default Belagavi region)\n`;
  }

  if (currentZone) {
    contextDescription += `GEOFENCE ZONE STATUS: Inside "${currentZone.name}" [Risk Category: ${currentZone.zoneType.toUpperCase()}]\n`;
    contextDescription += `Zone Details: ${currentZone.description}\n`;
  } else {
    contextDescription += `GEOFENCE ZONE STATUS: Outside high-risk perimeters (General Safe Green Corridor)\n`;
  }

  if (activeSos) {
    contextDescription += `🚨 ACTIVE SOS STATUS: Tourist currently has an ACTIVE EMERGENCY SOS triggered with Police Control Room!\n`;
  }

  if (nearestPolice) {
    const pDist = String(nearestPolice.formattedDistance || nearestPolice.distanceFormatted || '').replace(/\s+away$/i, '') + ' away';
    contextDescription += `Nearest Police Station: ${nearestPolice.name} (${pDist}) | Phone: ${nearestPolice.phone} | Helpline: 112 | Address: ${nearestPolice.address}\n`;
  }
  if (nearestHospital) {
    const hDist = String(nearestHospital.formattedDistance || nearestHospital.distanceFormatted || '').replace(/\s+away$/i, '') + ' away';
    contextDescription += `Nearest Hospital: ${nearestHospital.name} (${hDist}) | Phone: ${nearestHospital.phone} | Ambulance: 108 | Address: ${nearestHospital.address}\n`;
  }
  if (nearestPharmacy) {
    const phDist = String(nearestPharmacy.formattedDistance || nearestPharmacy.distanceFormatted || '').replace(/\s+away$/i, '') + ' away';
    contextDescription += `Nearest 24/7 Pharmacy / Medical Shop: ${nearestPharmacy.name} (${phDist}) | Phone: ${nearestPharmacy.phone} | Address: ${nearestPharmacy.address || ''}\n`;
  }

  if (topHavens && topHavens.length > 0) {
    contextDescription += `Nearby Verified Safe Havens:\n`;
    topHavens.forEach((h) => {
      const hDist = String(h.formattedDistance || h.distanceFormatted || '').replace(/\s+away$/i, '') + ' away';
      contextDescription += `- ${h.name} (${h.typeName}): ${hDist}, Phone: ${h.phone}\n`;
    });
  }

  if (recentAnnouncements && recentAnnouncements.length > 0) {
    contextDescription += `Official Police Advisories & Announcements:\n`;
    recentAnnouncements.forEach((a) => {
      contextDescription += `- [${a.type || 'Notice'}] ${a.title}: ${a.message}\n`;
    });
  }

  if (retrievedDestinations && retrievedDestinations.length > 0) {
    contextDescription += `\n=== RETRIEVED TOURISM KNOWLEDGE (RAG) ===\n`;
    retrievedDestinations.forEach((d) => {
      contextDescription += `Place: ${d.name} (${d.region}) [Safety: ${d.safetyRating}]\n`;
      contextDescription += `Timings: ${d.timings} | Fee: ${d.entryFee} | Best Time: ${d.bestTimeToVisit}\n`;
      contextDescription += `Summary: ${d.summary}\n`;
      contextDescription += `Key Highlights: ${d.highlights.join('; ')}\n`;
      contextDescription += `Safety Tips & Restrictions: ${d.safetyTips.join('; ')}\n`;
      contextDescription += `Nearest Emergency Aid: Police: ${d.nearestPoliceStation}; Hospital: ${d.nearestHospital}\n\n`;
    });
  }

  if (matchedProtocols && matchedProtocols.length > 0) {
    contextDescription += `\n=== EMERGENCY ACTION PROTOCOLS ===\n`;
    matchedProtocols.forEach((p) => {
      contextDescription += `${p.title}:\n${p.steps.join('\n')}\n\n`;
    });
  }

  if (safetyTips) {
    contextDescription += `\n=== TRAVEL SAFETY TIPS ===\n`;
    contextDescription += `Solo Travel: ${safetyTips.soloTravel.join('; ')}\n`;
    contextDescription += `Family Travel: ${safetyTips.familyTravel.join('; ')}\n`;
    contextDescription += `Packing: ${safetyTips.packingChecklist.join('; ')}\n`;
  }

  const systemInstructions = `You are "Raksha AI", the intelligent Smart Tourist Safety Assistant and Tourism Guide for the Raksha Setu platform.
Your mission is to protect tourists, provide authoritative local guidance, recommend safe travel destinations, explain danger/restricted zones, and offer immediate emergency assistance.

RULES:
1. Always base your response on the REAL live telemetry provided above (GPS location, nearest police station, nearest hospital, active geofence zone).
2. NEVER give generic robot answers. Speak warmly, respectfully, clearly, and authoritatively.
3. If the user asks about their safety or current location, check the GEOFENCE ZONE STATUS and tell them clearly whether they are safe, in caution, or restricted, and mention their nearest police station and hospital with exact distances.
4. If the user asks for tourist attractions (Belagavi Fort, Hampi, Gokak Falls, etc.), share interesting historical insights, timings, entry fees, highlights, AND critical safety tips (e.g., slippery rocks at Gokak Falls, Tungabhadra river currents at Hampi, monkey precautions at Badami).
5. If the user is in danger, lost, or having a medical emergency:
   - Provide reassuring, immediate step-by-step instructions.
   - Mention Police Helpline 112 and Ambulance 108.
   - Mention the exact distance and name of their nearest hospital / police station from the telemetry above.
   - Advise them to use the 1-tap SOS trigger.
6. General Knowledge & Mathematics: You are a fully capable, intelligent assistant! If the user asks general knowledge questions (e.g. 'who is Virat Kohli', sports, science, world events, culture, history) or math calculations (e.g. '100+200', travel budget sums), ALWAYS ANSWER THEM COMPLETELY, ACCURATELY, AND POLITELY. Never refuse to answer general questions or math!
7. At the very end of your response, output two machine-readable blocks:
   [ACTIONS: ACTION1, ACTION2]
   Where ACTION can be one or more of: TRIGGER_SOS, OPEN_RADAR, CALL_112, CALL_108, OPEN_VOICE_BOARD, VIEW_ZONES
   (Only include actions relevant to the current conversation).
   
   [SUGGESTIONS: Suggestion Question 1 | Suggestion Question 2 | Suggestion Question 3]
   Provide 2 or 3 short, highly relevant follow-up questions the tourist can tap.

Formatting: Use clean Markdown, bold headers, bullet points, and appropriate emojis.`;

  return {
    systemInstructions,
    contextDescription,
    prompt: `Tourist Query: "${userQuery}"\n\nGenerate your helpful, safety-focused response based on the above telemetry and knowledge.`,
  };
}

module.exports = {
  buildTouristContext,
  buildGeminiPrompt,
};

