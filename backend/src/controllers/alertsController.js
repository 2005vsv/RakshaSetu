const Alert = require("../models/Alert");
const AuditLog = require("../models/AuditLog");

exports.listAlerts = async (req, res) => {
  try {
    if (req.user?.role === "admin" && req.user.adminRole === "responder") return res.status(403).json({ error: "Responders can access incidents assigned to them from Incident Management" });
    const filter = req.user?.role === "admin" ? {} : { user: req.user.id };
    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(100);
    // Keep the API contract explicit and aligned with the tourist and police UIs.
    const normalized = alerts.map((alert) => ({ ...alert.toObject(), status: alert.is_resolved ? "resolved" : "active" }));
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
};

exports.createAlert = async (req, res) => {
  try {
    const { type, severity = "medium", message, geoLocation } = req.body;
    if (!type || !message) return res.status(400).json({ error: "type and message are required" });
    if (["sos", "panic"].includes(String(type).toLowerCase())) return res.status(409).json({ error: "Emergency alerts must use the incident workflow at POST /incidents/sos" });
    if (!/^[a-z][a-z0-9_-]{1,39}$/i.test(String(type)) || String(message).trim().length > 1000) return res.status(400).json({ error: "Alert type or message is invalid" });
    if (geoLocation?.coordinates && (!Array.isArray(geoLocation.coordinates) || geoLocation.coordinates.length !== 2 || !Number.isFinite(Number(geoLocation.coordinates[0])) || Math.abs(Number(geoLocation.coordinates[0])) > 180 || !Number.isFinite(Number(geoLocation.coordinates[1])) || Math.abs(Number(geoLocation.coordinates[1])) > 90)) return res.status(400).json({ error: "Alert coordinates are invalid" });
    const a = new Alert({ type, severity, message, geoLocation, user: req.user?.id });
    await a.save();
    if (req.user.role === "admin") await AuditLog.create({ actor: req.user.id, action: "alert.created", targetType: "alert", targetId: a._id.toString(), details: { type: a.type, severity: a.severity } });
    req.app.get("io")?.to("admins").emit("alert:new", { alert: a.toObject() });
    res.status(201).json({ ...a.toObject(), status: "active" });
  } catch (err) {
    res.status(400).json({ error: "Invalid data" });
  }
};

exports.assignAlert = async (req, res) => {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ error: "Administrator access required" });
    if (req.user.adminRole === "responder") return res.status(403).json({ error: "Monitoring officer access required" });
    const { id } = req.params;
    const { station_id, station_name } = req.body;
    if (!station_id || !station_name) {
      return res.status(400).json({ error: "station_id and station_name are required" });
    }
    const updated = await Alert.findOneAndUpdate(
      { _id: id, ...(req.user?.role === "admin" ? {} : { user: req.user.id }) },
      { $set: { assigned_station_id: station_id, assigned_station_name: station_name } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Alert not found" });
    await AuditLog.create({ actor: req.user.id, action: "alert.assigned", targetType: "alert", targetId: updated._id.toString(), details: { station_id, station_name } });
    req.app.get("io")?.to("admins").emit("alert:updated", { alert: updated.toObject() });
    res.json({ ...updated.toObject(), status: updated.is_resolved ? "resolved" : "active" });
  } catch (err) {
    res.status(500).json({ error: "Failed to assign alert" });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    if (req.user?.role === "admin" && req.user.adminRole === "responder") return res.status(403).json({ error: "Monitoring officer access required" });
    const updated = await Alert.findOneAndUpdate(
      { _id: req.params.id, ...(req.user?.role === "admin" ? {} : { user: req.user.id }) },
      { $set: { is_resolved: true } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Alert not found" });
    if (req.user.role === "admin") await AuditLog.create({ actor: req.user.id, action: "alert.resolved", targetType: "alert", targetId: updated._id.toString() });
    req.app.get("io")?.to("admins").emit("alert:updated", { alert: updated.toObject() });
    res.json({ ...updated.toObject(), status: "resolved" });
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve alert" });
  }
};
