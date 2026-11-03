const router = require("express").Router();
const Zone = require("../models/Zone");
const auth = require("../middleware/auth");
const { validateGeometry, parseWkt } = require("../utils/polygon");
const AuditLog = require("../models/AuditLog");

router.use(auth);

router.get("/", async (req, res) => {
  try {
    const filter = req.query.only_active === "false" ? {} : { is_active: true };
    res.json({ zones: await Zone.find(filter).sort({ createdAt: -1 }).lean() });
  } catch {
    res.status(500).json({ error: "Could not load geofences" });
  }
});

router.post("/", async (req, res) => {
  const geometry = req.body.geometry || parseWkt(req.body.wkt_polygon);
  if (!String(req.body.name || "").trim() || !["safe", "risky", "restricted"].includes(req.body.zone_type) || !validateGeometry(geometry)) {
    return res.status(400).json({ error: "Provide a name, valid zone type, and a closed Polygon or MultiPolygon with longitude/latitude coordinates" });
  }
  try {
    const zone = await Zone.create({
      name: String(req.body.name).trim(),
      description: String(req.body.description || "").trim(),
      zone_type: req.body.zone_type,
      geometry,
      createdBy: req.user?.id,
      is_active: req.body.is_active !== false,
    });
    if (req.user?.id) {
      await AuditLog.create({
        actor: req.user.id,
        action: "geofence.created",
        targetType: "zone",
        targetId: zone._id.toString(),
        details: { name: zone.name, zone_type: zone.zone_type },
      }).catch(() => {});
    }
    req.app.get("io")?.emit("geofence:created", zone);
    req.app.get("io")?.emit("zone:created", zone);
    res.status(201).json(zone);
  } catch {
    res.status(500).json({ error: "Could not save geofence in MongoDB" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.is_active === "boolean") updates.is_active = req.body.is_active;
    if (typeof req.body.name === "string" && req.body.name.trim()) updates.name = req.body.name.trim().slice(0, 120);
    const zone = await Zone.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!zone) return res.status(404).json({ error: "Geofence not found" });
    if (req.user?.id) {
      await AuditLog.create({
        actor: req.user.id,
        action: "geofence.updated",
        targetType: "zone",
        targetId: zone._id.toString(),
        details: Object.keys(updates),
      }).catch(() => {});
    }
    if (zone.is_active === false) {
      // Clean up alerts associated with deactivated zone
      const Alert = require("../models/Alert");
      await Alert.deleteMany({ geofenceZone: zone._id }).catch(() => {});
      if (zone.name) {
        await Alert.deleteMany({ type: "geofence", message: { $regex: zone.name, $options: "i" } }).catch(() => {});
      }
      req.app.get("io")?.emit("geofence:deactivated", zone);
      req.app.get("io")?.emit("geofence:deleted", zone);
      req.app.get("io")?.emit("zone:deleted", zone);
      req.app.get("io")?.emit("alert:updated");
      req.app.get("io")?.to("admins").emit("alert:updated");
    }
    req.app.get("io")?.emit("geofence:updated", zone);
    req.app.get("io")?.emit("zone:updated", zone);
    res.json(zone);
  } catch {
    res.status(400).json({ error: "Could not update geofence" });
  }
});

router.delete("/:id", async (req, res) => {
  const zone = await Zone.findByIdAndUpdate(req.params.id, { $set: { is_active: false } }, { new: true });
  if (!zone) return res.status(404).json({ error: "Geofence not found" });
  if (req.user?.id) {
    await AuditLog.create({
      actor: req.user.id,
      action: "geofence.deactivated",
      targetType: "zone",
      targetId: zone._id.toString(),
      details: { name: zone.name },
    }).catch(() => {});
  }
  
  // Clean up alerts associated with this deactivated zone so its location pin icon disappears from maps
  const Alert = require("../models/Alert");
  await Alert.deleteMany({ geofenceZone: zone._id }).catch(() => {});
  if (zone.name) {
    await Alert.deleteMany({ type: "geofence", message: { $regex: zone.name, $options: "i" } }).catch(() => {});
  }
  
  const io = req.app.get("io");
  io?.emit("geofence:deactivated", zone);
  io?.emit("geofence:deleted", zone);
  io?.emit("zone:deleted", zone);
  io?.emit("alert:updated");
  io?.to("admins").emit("alert:updated");
  res.json({ success: true, zone });
});

module.exports = router;
