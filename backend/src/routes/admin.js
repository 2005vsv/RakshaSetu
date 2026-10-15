const router = require("express").Router();
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Incident = require("../models/Incident");
const Announcement = require("../models/Announcement");
const AuditLog = require("../models/AuditLog");
const SystemSetting = require("../models/SystemSetting");
const SupportRequest = require("../models/SupportRequest");

router.use(auth);
router.use((req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ error: "Administrator access required" }));
const audit = (req, action, targetType, targetId, details = {}) => AuditLog.create({ actor: req.user.id, action, targetType, targetId: String(targetId), details });
const superAdminOnly = (req, res, next) => req.user.adminRole === "super_admin" ? next() : res.status(403).json({ error: "Super administrator access required" });
const monitoringOnly = (req, res, next) => req.user.adminRole === "responder" ? res.status(403).json({ error: "Monitoring officer access required" }) : next();

router.get("/users", monitoringOnly, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = { role: "user" };
    if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }, { digitalId: { $regex: search, $options: "i" } }];
    res.json(await User.find(filter).select("name email phone digitalId accountStatus verificationStatus flagReason touristRole createdAt").sort({ createdAt: -1 }).limit(300).lean());
  } catch { res.status(500).json({ error: "Could not load tourist accounts" }); }
});

router.get("/users/export.csv", monitoringOnly, async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).select("name email phone digitalId accountStatus verificationStatus createdAt").sort({ createdAt: -1 }).limit(10000).lean();
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [["name", "email", "phone", "touristId", "accountStatus", "verificationStatus", "registeredAt"], ...users.map((item) => [item.name, item.email, item.phone, item.digitalId, item.accountStatus, item.verificationStatus, item.createdAt?.toISOString()])].map((row) => row.map(quote).join(",")).join("\r\n");
    await audit(req, "tourists.exported", "user", "csv", { count: users.length });
    res.type("text/csv").attachment("rakshasetu-tourists.csv").send(csv);
  } catch { res.status(500).json({ error: "Could not export tourist records" }); }
});

router.get("/users/:id", monitoringOnly, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: "user" }).select("name email phone digitalId accountStatus verificationStatus flagReason emergencyContacts preferences createdAt").lean();
    if (!user) return res.status(404).json({ error: "Tourist account not found" });
    const [trips, incidents] = await Promise.all([
      require("../models/Trip").find({ user: user._id }).sort({ createdAt: -1 }).limit(100).lean(),
      Incident.find({ tourist: user._id }).sort({ createdAt: -1 }).limit(100).select("incidentRef status severity createdAt assignedName resolution history").lean(),
    ]);
    res.json({ user, trips, incidents });
  } catch { res.status(400).json({ error: "Could not load tourist record" }); }
});

router.patch("/users/:id/verification", monitoringOnly, async (req, res) => {
  const status = req.body.status;
  const reason = String(req.body.reason || "").trim();
  if (!["verified", "flagged", "unverified"].includes(status) || (status === "flagged" && !reason)) return res.status(400).json({ error: "Choose a valid verification state and give a reason when flagging" });
  try {
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: "user" }, { $set: { verificationStatus: status, flagReason: status === "flagged" ? reason : "" } }, { new: true }).select("name digitalId verificationStatus flagReason");
    if (!user) return res.status(404).json({ error: "Tourist account not found" });
    await audit(req, `tourist.${status}`, "user", user._id, { digitalId: user.digitalId, reason: status === "flagged" ? reason : undefined });
    res.json(user);
  } catch { res.status(400).json({ error: "Could not update verification status" }); }
});

router.patch("/users/:id/profile", superAdminOnly, async (req, res) => {
  const updates = {};
  if (typeof req.body.name === "string" && req.body.name.trim()) updates.name = req.body.name.trim().slice(0, 120);
  if (typeof req.body.phone === "string" && /^\d{10}$/.test(req.body.phone.trim())) updates.phone = req.body.phone.trim();
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Provide a valid name or 10-digit phone number" });
  try {
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: "user" }, { $set: updates }, { new: true, runValidators: true }).select("name email phone digitalId");
    if (!user) return res.status(404).json({ error: "Tourist account not found" });
    await audit(req, "tourist.profile_corrected", "user", user._id, { fields: Object.keys(updates) });
    res.json(user);
  } catch { res.status(400).json({ error: "Could not update tourist profile" }); }
});

router.patch("/users/:id/status", superAdminOnly, async (req, res) => {
  if (!["active", "suspended"].includes(req.body.status)) return res.status(400).json({ error: "Status must be active or suspended" });
  try {
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: "user" }, { $set: { accountStatus: req.body.status } }, { new: true }).select("name email digitalId accountStatus");
    if (!user) return res.status(404).json({ error: "Tourist account not found" });
    await audit(req, `tourist.${req.body.status}`, "user", user._id, { digitalId: user.digitalId });
    res.json(user);
  } catch { res.status(400).json({ error: "Could not update tourist account" }); }
});

router.get("/admins", superAdminOnly, async (_req, res) => {
  try { res.json(await User.find({ role: "admin" }).select("name email adminRole accountStatus createdAt").sort({ createdAt: -1 }).lean()); }
  catch { res.status(500).json({ error: "Could not load administrator accounts" }); }
});

router.get("/responders", monitoringOnly, async (_req, res) => {
  try { res.json(await User.find({ role: "admin", adminRole: "responder", accountStatus: "active" }).select("name email adminRole").sort({ name: 1 }).lean()); }
  catch { res.status(500).json({ error: "Could not load active responders" }); }
});

router.post("/admins", superAdminOnly, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) return res.status(400).json({ error: "Name, valid email, and an initial password of at least 12 characters are required" });
  const adminRole = ["super_admin", "monitoring_officer", "responder"].includes(req.body.adminRole) ? req.body.adminRole : "responder";
  try {
    const user = await User.create({ name, email, username: email, role: "admin", adminRole, password: await bcrypt.hash(password, 12), digitalId: undefined });
    await audit(req, "admin.created", "user", user._id, { email, adminRole });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role, adminRole: user.adminRole, accountStatus: user.accountStatus });
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? "An account with that email already exists" : "Could not create administrator account" }); }
});

router.patch("/admins/:id/status", superAdminOnly, async (req, res) => {
  if (!["active", "suspended"].includes(req.body.status)) return res.status(400).json({ error: "Status must be active or suspended" });
  if (String(req.params.id) === String(req.user.id) && req.body.status === "suspended") return res.status(400).json({ error: "You cannot deactivate your own administrator account" });
  try {
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: "admin" }, { $set: { accountStatus: req.body.status }, $inc: { sessionVersion: 1 } }, { new: true }).select("name email accountStatus");
    if (!user) return res.status(404).json({ error: "Administrator account not found" });
    await audit(req, `admin.${req.body.status}`, "user", user._id);
    res.json(user);
  } catch { res.status(400).json({ error: "Could not update administrator account" }); }
});

router.patch("/admins/:id/role", superAdminOnly, async (req, res) => {
  const adminRole = req.body.adminRole;
  if (!["super_admin", "monitoring_officer", "responder"].includes(adminRole)) return res.status(400).json({ error: "Invalid administrator role" });
  try {
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: "admin" }, { $set: { adminRole }, $inc: { sessionVersion: 1 } }, { new: true }).select("name email adminRole accountStatus");
    if (!user) return res.status(404).json({ error: "Administrator account not found" });
    await audit(req, "admin.role_changed", "user", user._id, { adminRole });
    res.json(user);
  } catch { res.status(400).json({ error: "Could not change administrator role" }); }
});

router.get("/announcements", async (_req, res) => {
  try { res.json(await Announcement.find().populate("author", "name").sort({ createdAt: -1 }).limit(200).lean()); }
  catch { res.status(500).json({ error: "Could not load announcements" }); }
});
router.post("/announcements", async (req, res) => {
  const title = String(req.body.title || "").trim();
  const body = String(req.body.body || "").trim();
  const severity = ["info", "warning", "urgent"].includes(req.body.severity) ? req.body.severity : "info";
  if (!title || !body) return res.status(400).json({ error: "Announcement title and message are required" });
  try {
    const announcement = await Announcement.create({ title, body, severity, author: req.user.id });
    await audit(req, "announcement.published", "announcement", announcement._id, { severity });
    req.app.get("io")?.emit("announcement:published", { announcement: announcement.toObject() });
    res.status(201).json(announcement);
  } catch { res.status(500).json({ error: "Could not publish announcement" }); }
});
router.delete("/announcements/:id", async (req, res) => {
  try {
    const item = await Announcement.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Announcement not found" });
    await audit(req, "announcement.deleted", "announcement", item._id);
    res.json({ success: true });
  } catch { res.status(400).json({ error: "Could not delete announcement" }); }
});

router.get("/audit", monitoringOnly, async (req, res) => {
  try { res.json(await AuditLog.find().populate("actor", "name email").sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 200, 500)).lean()); }
  catch { res.status(500).json({ error: "Could not load audit log" }); }
});

router.get("/support", monitoringOnly, async (_req, res) => {
  try { res.json(await SupportRequest.find().populate("tourist", "name email digitalId").sort({ createdAt: -1 }).limit(500).lean()); }
  catch { res.status(500).json({ error: "Could not load support inbox" }); }
});
router.patch("/support/:id", monitoringOnly, async (req, res) => {
  const status = req.body.status;
  const response = String(req.body.response || "").trim();
  if (!["open", "in_review", "closed"].includes(status) || response.length > 2000 || (status === "closed" && response.length < 5)) return res.status(400).json({ error: "Choose a valid support status; add a response before closing" });
  try {
    const request = await SupportRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Support request not found" });
    request.status = status;
    if (response) request.response = response;
    request.history.push({ status, note: response, actor: req.user.id });
    await request.save();
    await audit(req, `support.${status}`, "support_request", request._id, { category: request.category });
    const payload = { request: request.toObject() };
    req.app.get("io")?.to("admins").emit("support:updated", payload);
    req.app.get("io")?.to(`user:${request.tourist}`).emit("support:updated", payload);
    res.json(request);
  } catch { res.status(500).json({ error: "Could not update support request" }); }
});

router.get("/reports/incidents.csv", monitoringOnly, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && ["new", "acknowledged", "assigned", "responding", "resolved", "cancelled"].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.severity && ["low", "medium", "high", "critical"].includes(req.query.severity)) filter.severity = req.query.severity;
    if (req.query.kind && ["sos", "safety"].includes(req.query.kind)) filter.kind = req.query.kind;
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return res.status(400).json({ error: "Date filters must be valid dates" });
    filter.createdAt = { $gte: from, $lte: to };
    const incidents = await Incident.find(filter).populate("tourist", "name email digitalId").sort({ createdAt: -1 }).limit(10000).lean();
    const fields = ["reference", "createdAt", "touristName", "touristId", "severity", "status", "message", "latitude", "longitude", "assignedResponder", "resolvedAt", "resolution"];
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = incidents.map((item) => [item.incidentRef, item.createdAt?.toISOString(), item.tourist?.name, item.tourist?.digitalId, item.severity, item.status, item.message, item.location?.latitude, item.location?.longitude, item.assignedName, item.status === "resolved" ? item.updatedAt?.toISOString() : "", item.resolution].map(quote).join(","));
    await audit(req, "report.exported", "incident", "csv", { count: rows.length });
    res.type("text/csv").attachment("rakshasetu-incidents.csv").send([fields.map(quote).join(","), ...rows].join("\r\n"));
  } catch { res.status(500).json({ error: "Could not export incident report" }); }
});

router.get("/reports/incidents", monitoringOnly, async (req, res) => {
  try {
    const filter = {};
    for (const [key, allowed] of [["status", ["new", "acknowledged", "assigned", "responding", "resolved", "cancelled"]], ["severity", ["low", "medium", "high", "critical"]], ["kind", ["sos", "safety"]]]) if (allowed.includes(req.query[key])) filter[key] = req.query[key];
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return res.status(400).json({ error: "Date filters must be valid dates" });
    filter.createdAt = { $gte: from, $lte: to };
    const incidents = await Incident.find(filter).populate("tourist", "name digitalId").sort({ createdAt: -1 }).limit(2000).lean();
    await audit(req, "report.previewed", "incident", "filtered", { count: incidents.length });
    res.json(incidents);
  } catch { res.status(500).json({ error: "Could not build incident report" }); }
});

router.get("/reports/summary", monitoringOnly, async (req, res) => {
  try {
    const filter = {};
    for (const [key, allowed] of [["status", ["new", "acknowledged", "assigned", "responding", "resolved", "cancelled"]], ["severity", ["low", "medium", "high", "critical"]], ["kind", ["sos", "safety"]]]) if (allowed.includes(req.query[key])) filter[key] = req.query[key];
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return res.status(400).json({ error: "Date filters must be valid dates" });
    filter.createdAt = { $gte: from, $lte: to };
    const periodFormat = req.query.period === "weekly" ? "%G-W%V" : req.query.period === "monthly" ? "%Y-%m" : "%Y-%m-%d";
    const [byStatus, bySeverity, byKind, incidentTrend, registrationTrend, topLocations, resolved] = await Promise.all([
      Incident.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Incident.aggregate([{ $match: filter }, { $group: { _id: "$severity", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Incident.aggregate([{ $match: filter }, { $group: { _id: "$kind", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Incident.aggregate([{ $match: filter }, { $group: { _id: { $dateToString: { format: periodFormat, date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      User.aggregate([{ $match: { role: "user", createdAt: { $gte: from, $lte: to } } }, { $group: { _id: { $dateToString: { format: periodFormat, date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Incident.aggregate([{ $match: { ...filter, "location.latitude": { $exists: true }, "location.longitude": { $exists: true } } }, { $group: { _id: { latitude: { $round: ["$location.latitude", 2] }, longitude: { $round: ["$location.longitude", 2] } }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 20 }]),
      Incident.find({ ...filter, status: "resolved" }).select("createdAt history").limit(5000).lean(),
    ]);
    const responseMinutes = resolved.map((incident) => {
      const event = incident.history?.find((item) => item.status === "acknowledged");
      return event ? Math.max(0, new Date(event.at) - new Date(incident.createdAt)) / 60000 : null;
    }).filter((value) => value !== null);
    await audit(req, "report.summary_viewed", "incident", "summary", { period: req.query.period || "daily" });
    res.json({ period: req.query.period || "daily", byStatus, bySeverity, byKind, incidentTrend, registrationTrend, topLocations, averageAcknowledgementMinutes: responseMinutes.length ? responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length : null });
  } catch { res.status(500).json({ error: "Could not build report summary" }); }
});

router.get("/health", (_req, res) => {
  const mongoose = require("mongoose");
  res.json({ api: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected", realtime: reqAppIo(_req) ? "connected" : "unavailable" });
});

router.get("/settings", async (_req, res) => {
  try {
    const settings = await SystemSetting.findOneAndUpdate({ key: "global" }, { $setOnInsert: { key: "global" } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    res.json(settings);
  } catch { res.status(500).json({ error: "Could not load system settings" }); }
});

router.patch("/settings", superAdminOnly, async (req, res) => {
  const updates = {};
  for (const key of ["locationRetentionDays", "incidentRetentionDays", "alertRetentionDays", "auditRetentionDays"]) {
    if (req.body[key] !== undefined) {
      const value = Number(req.body[key]);
      if (!Number.isInteger(value) || value < 0 || value > 3650) return res.status(400).json({ error: `${key} must be an integer from 0 to 3650 (0 disables automatic deletion)` });
      updates[key] = value;
    }
  }
  if (req.body.alertSoundEnabled !== undefined) {
    if (typeof req.body.alertSoundEnabled !== "boolean") return res.status(400).json({ error: "alertSoundEnabled must be a boolean" });
    updates.alertSoundEnabled = req.body.alertSoundEnabled;
  }
  if (req.body.criticalSeverityThreshold !== undefined) {
    if (!["medium", "high", "critical"].includes(req.body.criticalSeverityThreshold)) return res.status(400).json({ error: "Invalid critical severity threshold" });
    updates.criticalSeverityThreshold = req.body.criticalSeverityThreshold;
  }
  try {
    const settings = await SystemSetting.findOneAndUpdate({ key: "global" }, { $set: { ...updates, updatedBy: req.user.id }, $setOnInsert: { key: "global" } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    await audit(req, "system.settings_updated", "settings", "global", Object.keys(updates));
    res.json(settings);
  } catch { res.status(400).json({ error: "Could not save system settings" }); }
});
function reqAppIo(req) { return req.app.get("io"); }

module.exports = router;
