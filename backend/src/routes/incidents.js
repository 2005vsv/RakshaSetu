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
    const io = req.app.get("io");
    io?.to("admins").emit("incident:new", { incident: { ...incident.toObject(), tourist: { _id: user._id, name: user.name, digitalId: user.digitalId, phone: user.phone, emergencyContacts: user.emergencyContacts } } });
    io?.to(`user:${user._id}`).emit("incident:updated", { incident: incident.toObject() });
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
