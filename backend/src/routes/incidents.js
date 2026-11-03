const router = require("express").Router();
const crypto = require("crypto");
const Incident = require("../models/Incident");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");
const rateLimit = require("express-rate-limit").rateLimit;
const sosLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: "Too many SOS submissions. If you are in immediate danger, call 112 now." } });

const adminOnly = (req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ error: "Administrator access required" });
const dto = (incident) => incident;

router.get("/public/verify/:digitalId", async (req, res) => {
  try {
    const user = await User.findOne({ digitalId: String(req.params.digitalId).toUpperCase(), role: "user", accountStatus: "active" }).select("name digitalId createdAt accountStatus").lean();
    if (!user) return res.status(404).json({ valid: false, error: "Tourist ID was not found or is inactive" });
    res.json({ valid: true, name: user.name, digitalId: user.digitalId, registrationStatus: "active", registeredAt: user.createdAt });
  } catch { res.status(500).json({ error: "Could not verify tourist ID" }); }
});


// --- Public / Gateway Ingestion Endpoints (Resilient Emergency Access) ---

// 1. Offline SMS Beacon Sync from Mobile App
router.post("/offline-beacon", async (req, res) => {
  try {
    const jwt = require("jsonwebtoken");
    const Alert = require("../models/Alert");
    let touristUser = null;

    // A. Check Authorization header if present
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, "");
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "local-development-secret-change-before-deployment");
        if (decoded?.id) {
          touristUser = await User.findById(decoded.id);
        }
      } catch (_) {}
    }

    // B. Match by digitalId or phone from beacon payload
    if (!touristUser && req.body.digitalId) {
      touristUser = await User.findOne({ digitalId: String(req.body.digitalId).toUpperCase() });
    }
    if (!touristUser && req.body.phone) {
      touristUser = await User.findOne({ phone: req.body.phone });
    }

    // C. Fallback to any active tourist account
    if (!touristUser) {
      touristUser = (await User.findOne({ role: "user", accountStatus: "active" })) || (await User.findOne({ role: "user" }));
    }

    if (!touristUser) {
      return res.status(400).json({ error: "No matching tourist record found" });
    }

    // De-duplication check by beacon ID
    const beaconId = req.body.id || req.body.beaconId;
    if (beaconId) {
      const existing = await Incident.findOne({ dedupeKey: `offline:${beaconId}` });
      if (existing) {
        return res.status(200).json({ ...existing.toObject(), duplicate: true, synced: true });
      }
    }

    // Extract GPS coordinates
    const lat = req.body.location?.latitude ?? req.body.latitude;
    const lng = req.body.location?.longitude ?? req.body.longitude;
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;

    const touristName = req.body.touristName || touristUser.name || "Tourist";
    const digitalId = req.body.digitalId || touristUser.digitalId || "DIG-TOURIST";
    const rawMessage = req.body.message || "Emergency distress signal dispatched via Cellular SMS";
    const formattedMessage = `[📴 OFFLINE SMS BEACON] ${rawMessage}`;

    // Create Incident record
    const incident = await Incident.create({
      incidentRef: `RS-OFFLINE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      tourist: touristUser._id,
      dedupeKey: beaconId ? `offline:${beaconId}` : undefined,
      kind: "sos",
      severity: "high",
      message: formattedMessage.slice(0, 1000),
      location: hasCoords ? {
        latitude: Number(lat),
        longitude: Number(lng),
        accuracy: req.body.location?.accuracy || 15,
        recordedAt: new Date(req.body.timestamp || Date.now()),
      } : undefined,
      history: [{
        status: "new",
        note: `📴 Offline Distress Beacon received via Cellular SMS Network (Recipients: ${Array.isArray(req.body.recipients) ? req.body.recipients.join(', ') : '112 Emergency Line'}). Synced to Police Control Room.`,
        actor: touristUser._id,
        actorName: `${touristName} (Offline SMS)`,
        at: new Date(),
      }],
    });

    // Create Alert record for Alert Centre
    let alertDoc = null;
    try {
      alertDoc = await Alert.create({
        user: touristUser._id,
        type: "sos",
        severity: "high",
        message: `🚨 [📴 OFFLINE SMS BEACON] Tourist ${touristName} (#${digitalId}): ${rawMessage}`,
        geoLocation: hasCoords ? { type: "Point", coordinates: [Number(lng), Number(lat)] } : undefined,
        location: hasCoords ? { latitude: Number(lat), longitude: Number(lng), recordedAt: new Date() } : undefined,
        is_resolved: false,
      });
    } catch (aErr) {
      console.warn("Failed to create Alert for offline beacon:", aErr.message);
    }

    // Realtime broadcast via Socket.IO
    const io = req.app.get("io");
    const incPayload = {
      incident: {
        ...incident.toObject(),
        tourist: {
          _id: touristUser._id,
          name: touristName,
          digitalId: digitalId,
          phone: touristUser.phone,
          emergencyContacts: touristUser.emergencyContacts,
        },
      },
    };
    io?.to("admins").emit("incident:new", incPayload);
    io?.emit("incident:new", incPayload);

    if (alertDoc) {
      const alertPayload = {
        alert: {
          ...alertDoc.toObject(),
          latitude: hasCoords ? Number(lat) : undefined,
          longitude: hasCoords ? Number(lng) : undefined,
          user: {
            _id: touristUser._id,
            name: touristName,
            digitalId: digitalId,
            phone: touristUser.phone,
          },
        },
      };
      io?.to("admins").emit("alert:new", alertPayload);
      io?.emit("alert:new", alertPayload);
    }

    res.status(201).json({
      success: true,
      synced: true,
      incident: incident.toObject(),
      alert: alertDoc ? alertDoc.toObject() : null,
    });
  } catch (err) {
    console.error("Offline beacon sync error:", err);
    res.status(500).json({ error: "Failed to process offline beacon: " + err.message });
  }
});

// 2. Inbound SMS Gateway (Twilio webhook / Cellular modem / Manual Ingestion)
router.post("/sms-inbound", async (req, res) => {
  try {
    const Alert = require("../models/Alert");
    const rawBody = String(req.body.Body || req.body.message || req.body.text || "").trim();
    if (!rawBody) {
      return res.status(400).json({ error: "SMS message text is required" });
    }

    // Parse Digital ID from SMS (e.g. #DIG-TOURIST, #RS-1234, etc.)
    const digitalIdMatch = rawBody.match(/#([A-Z0-9_-]+)/i);
    const digitalId = digitalIdMatch ? digitalIdMatch[1].toUpperCase() : null;

    // Parse Tourist name from SMS (e.g. "Tourist John" or "Tourist Vaishnav")
    const nameMatch = rawBody.match(/Tourist\s+([^#(]+)/i);
    const parsedName = nameMatch ? nameMatch[1].trim() : null;

    // Parse Lat & Lng from SMS (e.g. "Lat: 15.8152, Lng: 74.4875" or "q=15.8152,74.4875")
    let lat = null;
    let lng = null;
    const coordsMatch = rawBody.match(/Lat:\s*([0-9.-]+)[,\s]+Lng:\s*([0-9.-]+)/i) || rawBody.match(/q=([0-9.-]+),([0-9.-]+)/i);
    if (coordsMatch) {
      lat = parseFloat(coordsMatch[1]);
      lng = parseFloat(coordsMatch[2]);
    }
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    // Find tourist user
    let touristUser = null;
    if (digitalId) {
      touristUser = await User.findOne({ digitalId });
    }
    if (!touristUser && req.body.From) {
      const cleanPhone = String(req.body.From).replace(/\D/g, "").slice(-10);
      touristUser = await User.findOne({ phone: { $regex: cleanPhone } });
    }
    if (!touristUser) {
      touristUser = (await User.findOne({ role: "user", accountStatus: "active" })) || (await User.findOne({ role: "user" }));
    }

    const touristName = parsedName || touristUser?.name || "Tourist";
    const refDigitalId = digitalId || touristUser?.digitalId || "DIG-TOURIST";

    // Create Incident record
    const incident = await Incident.create({
      incidentRef: `RS-SMS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      tourist: touristUser?._id,
      dedupeKey: `sms:${Date.now()}:${crypto.randomBytes(2).toString("hex")}`,
      kind: "sos",
      severity: "high",
      message: `[📴 INBOUND CELLULAR SMS] ${rawBody}`.slice(0, 1000),
      location: hasCoords ? {
        latitude: lat,
        longitude: lng,
        accuracy: 15,
        recordedAt: new Date(),
      } : undefined,
      history: [{
        status: "new",
        note: `📴 Emergency Distress SMS received at Police Helpline Gateway (Sender: ${req.body.From || 'Cellular SMS Network'}). Auto-ingested into Control Room.`,
        actor: touristUser?._id,
        actorName: `${touristName} (112 SMS)`,
        at: new Date(),
      }],
    });

    // Create Alert record
    let alertDoc = null;
    try {
      alertDoc = await Alert.create({
        user: touristUser?._id,
        type: "sos",
        severity: "high",
        message: `🚨 [📴 INBOUND SMS] Tourist ${touristName} (#${refDigitalId}): ${rawBody}`,
        geoLocation: hasCoords ? { type: "Point", coordinates: [lng, lat] } : undefined,
        location: hasCoords ? { latitude: lat, longitude: lng, recordedAt: new Date() } : undefined,
        is_resolved: false,
      });
    } catch (aErr) {
      console.warn("Failed to create Alert for SMS inbound:", aErr.message);
    }

    // Realtime broadcast via Socket.IO
    const io = req.app.get("io");
    const incPayload = {
      incident: {
        ...incident.toObject(),
        tourist: {
          _id: touristUser?._id,
          name: touristName,
          digitalId: refDigitalId,
          phone: touristUser?.phone,
          emergencyContacts: touristUser?.emergencyContacts,
        },
      },
    };
    io?.to("admins").emit("incident:new", incPayload);
    io?.emit("incident:new", incPayload);

    if (alertDoc) {
      const alertPayload = {
        alert: {
          ...alertDoc.toObject(),
          latitude: hasCoords ? lat : undefined,
          longitude: hasCoords ? lng : undefined,
          user: {
            _id: touristUser?._id,
            name: touristName,
            digitalId: refDigitalId,
            phone: touristUser?.phone,
          },
        },
      };
      io?.to("admins").emit("alert:new", alertPayload);
      io?.emit("alert:new", alertPayload);
    }

    // Support Twilio XML response or JSON
    if (req.headers["user-agent"]?.includes("Twilio") || req.body.AccountSid) {
      res.type("text/xml");
      return res.send("<Response><Message>Emergency SOS received. Responders alerted.</Message></Response>");
    }

    res.status(201).json({
      success: true,
      incident: incident.toObject(),
      alert: alertDoc ? alertDoc.toObject() : null,
      parsed: { touristName, digitalId: refDigitalId, latitude: lat, longitude: lng },
    });
  } catch (err) {
    console.error("SMS inbound error:", err);
    res.status(500).json({ error: "Failed to process inbound SMS: " + err.message });
  }
});

router.use(auth);
router.get("/", async (req, res) => {
  try {
    const filter = req.user.role !== "admin" ? { tourist: req.user.id } : req.user.adminRole === "responder" ? { assignedTo: req.user.id } : {};
    const rows = await Incident.find(filter).sort({ createdAt: -1 }).limit(300)
      .populate("tourist", "name email phone digitalId emergencyContacts")
      .populate("assignedTo", "name email").lean();
    res.json(rows.map(dto));
  } catch { res.status(500).json({ error: "Could not load incidents" }); }
});

router.post("/sos", sosLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name digitalId phone emergencyContacts accountStatus preferences");
    if (!user || user.accountStatus !== "active") return res.status(403).json({ error: "This account cannot create incidents" });
    const existing = await Incident.findOne({ dedupeKey: `sos:${user._id}` });
    if (existing) return res.status(200).json({ ...existing.toObject(), duplicate: true });
    const permittedLocation = user.preferences?.locationSharing && user.preferences?.shareWithPolice ? req.body.location : null;
    const { latitude, longitude, accuracy, recordedAt } = permittedLocation || {};
    const hasLat = latitude !== undefined && latitude !== null;
    const hasLng = longitude !== undefined && longitude !== null;
    if (hasLat !== hasLng || (hasLat && (!Number.isFinite(Number(latitude)) || Math.abs(latitude) > 90 || !Number.isFinite(Number(longitude)) || Math.abs(longitude) > 180))) return res.status(400).json({ error: "Location coordinates are invalid" });
    const incident = await Incident.create({
      incidentRef: `RS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      tourist: user._id,
      dedupeKey: `sos:${user._id}`,
      message: String(req.body.message || "Tourist requested emergency assistance").trim().slice(0, 1000),
      severity: "high",
      location: hasLat ? { latitude: Number(latitude), longitude: Number(longitude), accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : undefined, recordedAt: recordedAt ? new Date(recordedAt) : new Date() } : undefined,
      history: [{ status: "new", note: "SOS submitted", actor: user._id, actorName: user.name || "Tourist" }],
    });
    const Alert = require("../models/Alert");
    let alertDoc = null;
    try {
      alertDoc = await Alert.create({
        user: user._id,
        type: "sos",
        severity: "high",
        message: `🚨 Emergency SOS: ${user.name || "Tourist"} (${user.digitalId || "ID"}) - ${incident.message}`,
        geoLocation: hasLat ? { type: "Point", coordinates: [Number(longitude), Number(latitude)] } : undefined,
        location: hasLat ? { latitude: Number(latitude), longitude: Number(longitude), recordedAt: new Date() } : undefined,
        is_resolved: false,
      });
    } catch (aErr) {
      console.warn("Failed to create Alert for SOS:", aErr.message);
    }

    const io = req.app.get("io");
    const incPayload = { incident: { ...incident.toObject(), tourist: { _id: user._id, name: user.name, digitalId: user.digitalId, phone: user.phone, emergencyContacts: user.emergencyContacts } } };
    io?.to("admins").emit("incident:new", incPayload);
    io?.emit("incident:new", incPayload);
    io?.to(`user:${user._id}`).emit("incident:updated", { incident: incident.toObject() });

    if (alertDoc) {
      const alertPayload = {
        alert: {
          ...alertDoc.toObject(),
          latitude: hasLat ? Number(latitude) : undefined,
          longitude: hasLat ? Number(longitude) : undefined,
          user: { _id: user._id, name: user.name, digitalId: user.digitalId, phone: user.phone }
        }
      };
      io?.to("admins").emit("alert:new", alertPayload);
      io?.emit("alert:new", alertPayload);
    }
    res.status(201).json(incident);
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Incident.findOne({ dedupeKey: `sos:${req.user.id}` });
      if (existing) return res.status(200).json({ ...existing.toObject(), duplicate: true });
    }
    console.error("SOS incident creation failed:", error.message);
    res.status(500).json({ error: "Could not submit SOS" });
  }
});

router.patch("/:id/cancel", async (req, res) => {
  const note = String(req.body.reason || "").trim();
  if (note.length < 6 || note.length > 500) return res.status(400).json({ error: "Explain why this SOS was triggered accidentally (6–500 characters)" });
  try {
    const incident = await Incident.findOne({ _id: req.params.id, tourist: req.user.id });
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    if (incident.status !== "new") return res.status(409).json({ error: "An incident can only be cancelled before an operator acknowledges it. Contact the response team." });
    incident.status = "cancelled";
    incident.dedupeKey = undefined;
    incident.history.push({ status: "cancelled", note, actor: req.user.id, actorName: "Tourist" });
    await incident.save();
    await AuditLog.create({ actor: req.user.id, action: "incident.cancelled", targetType: "incident", targetId: incident._id.toString(), details: { incidentRef: incident.incidentRef } });
    const payload = { incident: incident.toObject() };
    req.app.get("io")?.to("admins").emit("incident:updated", payload);
    req.app.get("io")?.to(`user:${incident.tourist}`).emit("incident:updated", payload);
    res.json(incident);
  } catch { res.status(500).json({ error: "Could not cancel incident" }); }
});

router.patch("/:id/status", adminOnly, async (req, res) => {
  try {
    const { status, note = "" } = req.body;
    const allowed = ["acknowledged", "assigned", "responding", "resolved", "cancelled", "new"];
    if (!allowed.includes(status) || typeof note !== "string" || note.length > 2000) return res.status(400).json({ error: "Invalid status or note" });
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    if (req.user.adminRole === "responder" && String(incident.assignedTo || "") !== String(req.user.id)) return res.status(403).json({ error: "Responders can update only incidents assigned to them" });
    const transitions = { new: ["acknowledged", "cancelled"], acknowledged: ["assigned", "responding", "resolved", "cancelled"], assigned: ["responding", "resolved", "cancelled"], responding: ["resolved", "assigned"], resolved: ["new"], cancelled: ["new"] };
    if (!transitions[incident.status]?.includes(status)) return res.status(409).json({ error: `Cannot move incident from ${incident.status} to ${status}` });
    if (status === "new" && await Incident.exists({ dedupeKey: `sos:${incident.tourist}`, _id: { $ne: incident._id } })) return res.status(409).json({ error: "Another active SOS already exists for this tourist" });
    const previousResponder = incident.assignedTo;
    if (status === "assigned") {
      if (!req.body.responderId) return res.status(400).json({ error: "Select an active responder before assigning" });
      const responder = await User.findOne({ _id: req.body.responderId, role: "admin", adminRole: "responder", accountStatus: "active" }).select("name");
      if (!responder) return res.status(400).json({ error: "Active responder account not found" });
      incident.assignedTo = responder._id;
      incident.assignedName = responder.name || "Response team";
    }
    incident.status = status;
    if (["resolved", "cancelled"].includes(status)) incident.dedupeKey = undefined;
    if (status === "new") {
      incident.dedupeKey = `sos:${incident.tourist}`;
      incident.assignedTo = null;
      incident.assignedName = "";
    }
    if (status === "resolved") incident.resolution = note.trim();
    if (["resolved", "cancelled"].includes(status)) {
      const Alert = require("../models/Alert");
      await Alert.updateMany(
        { user: incident.tourist?._id || incident.tourist, type: "sos", is_resolved: false },
        { $set: { is_resolved: true } }
      ).catch(() => {});
      io?.to("admins").emit("alert:updated", {});
      io?.emit("alert:updated", {});
    }
    incident.history.push({ status, note: note.trim(), actor: req.user.id, actorName: req.user.name || req.user.email || "Administrator" });
    await incident.save();
    await incident.populate("tourist", "name email phone digitalId emergencyContacts");
    await AuditLog.create({ actor: req.user.id, action: `incident.${status}`, targetType: "incident", targetId: incident._id.toString(), details: { incidentRef: incident.incidentRef } });
    const io = req.app.get("io");
    const payload = { incident: incident.toObject() };
    io?.to("admins").emit("incident:updated", payload);
    if (incident.assignedTo) io?.to(`responder:${incident.assignedTo}`).emit("incident:updated", payload);
    if (previousResponder && String(previousResponder) !== String(incident.assignedTo || "")) io?.to(`responder:${previousResponder}`).emit("incident:updated", payload);
    io?.to(`user:${incident.tourist?._id || incident.tourist}`).emit("incident:updated", payload);
    res.json(incident);
  } catch (error) { res.status(500).json({ error: "Could not update incident" }); }
});

router.post("/:id/assign-police", adminOnly, async (req, res) => {
  try {
    const { officerIds = [], note = "" } = req.body;
    if (!Array.isArray(officerIds) || !officerIds.length) {
      return res.status(400).json({ error: "Please select at least one police officer to assign." });
    }

    const incident = await Incident.findById(req.params.id).populate("tourist", "name email phone digitalId emergencyContacts");
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const officers = await User.find({ _id: { $in: officerIds } }).select("name phone policeBadge policeStation policeRank");
    if (!officers.length) return res.status(400).json({ error: "No matching police officers found" });

    incident.assignedPolice = incident.assignedPolice || [];
    const addedNames = [];

    for (const off of officers) {
      const exists = incident.assignedPolice.find((p) => String(p.officer) === String(off._id));
      if (!exists) {
        incident.assignedPolice.push({
          officer: off._id,
          name: off.name,
          badge: off.policeBadge || "PCR",
          station: off.policeStation || "Belagavi Police Station",
          phone: off.phone || "112",
          status: "assigned",
          assignedAt: new Date(),
          policeNote: note || "Assigned by Control Room Admin",
        });
        addedNames.push(`${off.name} (${off.policeStation || off.policeBadge})`);
      }
    }

    incident.status = "assigned";
    if (!incident.assignedTo && officers[0]) {
      incident.assignedTo = officers[0]._id;
      incident.assignedName = officers.map((o) => o.name).join(", ");
    } else if (officers.length) {
      incident.assignedName = officers.map((o) => o.name).join(", ");
    }

    incident.history.push({
      status: "assigned",
      note: `🚔 Police Dispatched & Assigned by Admin: ${addedNames.join("; ")}. ${note ? "Note: " + note : ""}`,
      actor: req.user.id,
      actorName: req.user.name || "Administrator",
      at: new Date(),
    });

    await incident.save();

    // Also update / link Efir
    const Efir = require("../models/Efir");
    await Efir.updateMany(
      { $or: [{ incidentId: incident._id }, { touristId: incident.tourist?.digitalId }] },
      {
        $set: { status: "assigned" },
        $addToSet: {
          assignedOfficers: {
            $each: officers.map((o) => ({
              id: o._id,
              name: o.name,
              badge: o.policeBadge,
              station: o.policeStation,
              phone: o.phone,
              status: "assigned",
              assignedAt: new Date(),
              policeNote: note,
            })),
          },
        },
      }
    ).catch(() => {});

    // Also update any active Alert for this tourist
    const Alert = require("../models/Alert");
    const stationName = officers.map((o) => `${o.name} (${o.policeStation?.split(",")[0] || o.policeBadge})`).join(", ");
    await Alert.updateMany(
      { user: incident.tourist?._id || incident.tourist, is_resolved: false },
      { $set: { assigned_station_id: String(officers[0]._id), assigned_station_name: stationName } }
    ).catch(() => {});

    const io = req.app.get("io");
    const payload = { incident: incident.toObject() };
    io?.emit("incident:updated", payload);
    io?.to("admins").emit("incident:updated", payload);
    io?.to("admins").emit("alert:updated", {});
    io?.to("police").emit("incident:updated", payload);
    for (const off of officers) {
      io?.to(`police:${off._id}`).emit("incident:updated", payload);
    }
    if (incident.tourist?._id) {
      io?.to(`user:${incident.tourist._id}`).emit("incident:updated", payload);
    }

    res.json({ incident, assignedPolice: incident.assignedPolice });
  } catch (err) {
    console.error("Assign police error:", err);
    res.status(500).json({ error: "Failed to assign police officers" });
  }
});

router.get("/admin/metrics", adminOnly, async (_req, res) => {
  try {
    const Trip = require("../models/Trip");
    const systemSettings = await require("../models/SystemSetting").findOne({ key: "global" }).lean();
    const threshold = systemSettings?.criticalSeverityThreshold || "high";
    const severitiesAtOrAbove = threshold === "medium" ? ["medium", "high", "critical"] : threshold === "critical" ? ["critical"] : ["high", "critical"];
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalTourists, sharingTourists, activeTrips, open, highPriority, byStatus, daily, recent, responseRows] = await Promise.all([
      User.countDocuments({ role: "user", accountStatus: "active" }),
      User.countDocuments({ role: "user", accountStatus: "active", "preferences.locationSharing": true }),
      Trip.countDocuments({ status: "active" }),
      Incident.countDocuments({ status: { $in: ["new", "acknowledged", "assigned", "responding"] } }),
      Incident.countDocuments({ severity: { $in: severitiesAtOrAbove }, status: { $in: ["new", "acknowledged", "assigned", "responding"] } }),
      Incident.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Incident.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Incident.find().sort({ createdAt: -1 }).limit(8).populate("tourist", "name digitalId").lean(),
      Incident.find({ status: "resolved" }).select("createdAt history").limit(1000).lean(),
    ]);
    const durations = responseRows.map((incident) => {
      const acknowledgement = incident.history?.find((event) => event.status === "acknowledged");
      return acknowledgement ? Math.max(0, new Date(acknowledgement.at) - new Date(incident.createdAt)) / 60000 : null;
    }).filter((value) => value !== null);
    res.json({ totalTourists, sharingTourists, activeTrips, openIncidents: open, highPriority, criticalSeverityThreshold: threshold, byStatus: Object.fromEntries(byStatus.map((row) => [row._id, row.count])), daily, averageAcknowledgementMinutes: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null, recent });
  } catch { res.status(500).json({ error: "Could not load operations metrics" }); }
});

router.get("/admin/locations", adminOnly, async (req, res) => {
  if (req.user.adminRole === "responder") return res.status(403).json({ error: "Monitoring officer access required" });
  try {
    const Location = require("../models/Location");
    const users = await User.find({ role: "user", accountStatus: "active", "preferences.locationSharing": true, "preferences.shareWithPolice": true }).select("name email digitalId").lean();
    const ids = users.map((user) => user._id);
    const [latest, activeTrips, openIncidents] = await Promise.all([
      Location.aggregate([{ $match: { user: { $in: ids } } }, { $sort: { recordedAt: -1 } }, { $group: { _id: "$user", point: { $first: "$$ROOT" } } }]),
      require("../models/Trip").find({ user: { $in: ids }, status: "active" }).select("user destination startPoint status").lean(),
      Incident.find({ tourist: { $in: ids }, status: { $in: ["new", "acknowledged", "assigned", "responding"] } }).select("tourist incidentRef status severity location createdAt").lean(),
    ]);
    const byId = new Map(latest.map((row) => [String(row._id), row.point]));
    res.json(users.map((user) => ({ tourist: user, location: byId.get(String(user._id)) || null, freshness: byId.has(String(user._id)) ? (Date.now() - new Date(byId.get(String(user._id)).recordedAt).getTime() < 5 * 60_000 ? "recent" : "stale") : "unavailable", activeTrip: activeTrips.find((trip) => String(trip.user) === String(user._id)) || null, incidents: openIncidents.filter((incident) => String(incident.tourist) === String(user._id)) })));
  } catch { res.status(500).json({ error: "Could not load consented locations" }); }
});

module.exports = router;
