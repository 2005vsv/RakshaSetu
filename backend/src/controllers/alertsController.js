const Alert = require("../models/Alert");
const AuditLog = require("../models/AuditLog");

exports.listAlerts = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "admin" || req.headers["x-portal"] === "admin";
    const Zone = require("../models/Zone");
    const Incident = require("../models/Incident");
    const inactiveZones = await Zone.find({ is_active: false }).select("_id").lean();
    const inactiveZoneIds = inactiveZones.map((z) => z._id);

    const filter = isAdmin
      ? { geofenceZone: { $nin: inactiveZoneIds } }
      : { user: req.user?.id, geofenceZone: { $nin: inactiveZoneIds } };

    const [alerts, activeIncidents] = await Promise.all([
      Alert.find(filter).sort({ createdAt: -1 }).limit(150),
      Incident.find(
        isAdmin
          ? { status: { $in: ["new", "acknowledged", "assigned", "responding"] } }
          : { tourist: req.user?.id, status: { $in: ["new", "acknowledged", "assigned", "responding"] } }
      ).populate("tourist", "name digitalId phone emergencyContacts").lean(),
    ]);
    
    // Normalize coordinates so frontend has direct, reliable access
    const normalized = alerts.map((alert) => {
      const obj = alert.toObject();
      let loc = obj.location;
      if (!loc && obj.geoLocation?.coordinates && (obj.geoLocation.coordinates[0] !== 0 || obj.geoLocation.coordinates[1] !== 0)) {
        loc = {
          latitude: obj.geoLocation.coordinates[1],
          longitude: obj.geoLocation.coordinates[0]
        };
      }
      return {
        ...obj,
        location: loc || undefined,
        latitude: loc?.latitude ?? obj.latitude,
        longitude: loc?.longitude ?? obj.longitude,
        status: alert.is_resolved ? "resolved" : "active"
      };
    });

    // Merge in any active SOS / Offline Beacon incidents not already captured in Alert collection
    for (const inc of activeIncidents) {
      const alreadyIncluded = normalized.some((a) =>
        (String(a._id) === String(inc._id) || (String(a.user) === String(inc.tourist?._id) && ["sos", "offline"].includes(String(a.type || "").toLowerCase()))) &&
        a.status === "active"
      );
      if (!alreadyIncluded) {
        const isOffline = String(inc.message || "").includes("OFFLINE");
        const lat = inc.location?.latitude;
        const lng = inc.location?.longitude;
        const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
        normalized.unshift({
          _id: inc._id,
          user: inc.tourist?._id,
          type: isOffline ? "offline" : "sos",
          severity: "high",
          message: isOffline
            ? `🚨 [📴 OFFLINE SMS BEACON] Tourist ${inc.tourist?.name || "Tourist"} (#${inc.tourist?.digitalId || "ID"}): ${inc.message}`
            : `🚨 Emergency SOS: ${inc.tourist?.name || "Tourist"} (#${inc.tourist?.digitalId || "ID"}) - ${inc.message}`,
          location: hasCoords ? { latitude: Number(lat), longitude: Number(lng), recordedAt: inc.createdAt } : undefined,
          latitude: hasCoords ? Number(lat) : undefined,
          longitude: hasCoords ? Number(lng) : undefined,
          geoLocation: hasCoords ? { type: "Point", coordinates: [Number(lng), Number(lat)] } : undefined,
          assigned_station_name: inc.assignedPolice?.[0]?.name ? `${inc.assignedPolice[0].name} (${inc.assignedPolice[0].station || 'Police'})` : (inc.assignedName || null),
          is_resolved: false,
          status: "active",
          createdAt: inc.createdAt,
          isIncidentSos: true,
        });
      }
    }

    res.json(normalized);
  } catch (err) {
    console.error("List alerts error:", err);
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
    if (req.user?.role === "admin") await AuditLog.create({ actor: req.user.id, action: "alert.created", targetType: "alert", targetId: a._id.toString(), details: { type: a.type, severity: a.severity } });
    req.app.get("io")?.to("admins").emit("alert:new", { alert: a.toObject() });
    res.status(201).json({ ...a.toObject(), status: "active" });
  } catch (err) {
    res.status(400).json({ error: "Invalid data" });
  }
};

exports.assignAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { station_id, station_name } = req.body;
    if (!station_id || !station_name) {
      return res.status(400).json({ error: "station_id and station_name are required" });
    }
    let updated = await Alert.findByIdAndUpdate(
      id,
      { $set: { assigned_station_id: station_id, assigned_station_name: station_name } },
      { new: true }
    );
    if (!updated) {
      const Incident = require("../models/Incident");
      const inc = await Incident.findByIdAndUpdate(
        id,
        { $set: { status: "assigned", assignedName: station_name, assignedTo: station_id } },
        { new: true }
      );
      if (inc) {
        req.app.get("io")?.to("admins").emit("incident:updated", { incident: inc.toObject() });
        req.app.get("io")?.to("admins").emit("alert:updated", {});
        req.app.get("io")?.emit("alert:updated", {});
        return res.json({ _id: inc._id, assigned_station_id: station_id, assigned_station_name: station_name, status: "active" });
      }
      return res.status(404).json({ error: "Alert not found" });
    }
    if (req.user?.id) await AuditLog.create({ actor: req.user.id, action: "alert.assigned", targetType: "alert", targetId: updated._id.toString(), details: { station_id, station_name } }).catch(() => {});
    req.app.get("io")?.to("admins").emit("alert:updated", { alert: updated.toObject() });
    req.app.get("io")?.emit("alert:updated", {});
    res.json({ ...updated.toObject(), status: updated.is_resolved ? "resolved" : "active" });
  } catch (err) {
    res.status(500).json({ error: "Failed to assign alert" });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    let updated = await Alert.findByIdAndUpdate(
      req.params.id,
      { $set: { is_resolved: true } },
      { new: true }
    );
    if (!updated) {
      const Incident = require("../models/Incident");
      const inc = await Incident.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "resolved", dedupeKey: undefined, resolution: "Resolved via Alert Centre" } },
        { new: true }
      );
      if (inc) {
        req.app.get("io")?.to("admins").emit("incident:updated", { incident: inc.toObject() });
        req.app.get("io")?.to("admins").emit("alert:updated", {});
        req.app.get("io")?.emit("alert:updated", {});
        return res.json({ _id: inc._id, status: "resolved", is_resolved: true });
      }
      return res.status(404).json({ error: "Alert not found" });
    }
    if (req.user?.id) await AuditLog.create({ actor: req.user.id, action: "alert.resolved", targetType: "alert", targetId: updated._id.toString() }).catch(() => {});
    req.app.get("io")?.to("admins").emit("alert:updated", { alert: updated.toObject() });
    req.app.get("io")?.emit("alert:updated", {});
    res.json({ ...updated.toObject(), status: "resolved" });
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve alert" });
  }
};
