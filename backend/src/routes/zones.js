const router = require("express").Router();
const Zone = require("../models/Zone");
const auth = require("../middleware/auth");
const { validateGeometry, parseWkt } = require("../utils/polygon");
const AuditLog = require("../models/AuditLog");

router.use(auth);
router.get("/", async (req, res) => {
  try {
    const filter = req.query.only_active === "true" ? { is_active: true } : {};
    res.json({ zones: await Zone.find(filter).sort({ createdAt: -1 }).lean() });
  } catch { res.status(500).json({ error: "Could not load geofences" }); }
});
router.post("/", async (req, res) => {
  if (req.user.role !== "admin" || req.user.adminRole === "responder") return res.status(403).json({ error: "Monitoring officer access required" });
  const geometry = req.body.geometry || parseWkt(req.body.wkt_polygon);
  if (!String(req.body.name || "").trim() || !["safe", "risky", "restricted"].includes(req.body.zone_type) || !validateGeometry(geometry)) return res.status(400).json({ error: "Provide a name, valid zone type, and a closed Polygon or MultiPolygon with longitude/latitude coordinates" });
  try {
    const zone = await Zone.create({ name: String(req.body.name).trim(), description: String(req.body.description || "").trim(), zone_type: req.body.zone_type, geometry, createdBy: req.user.id, is_active: req.body.is_active !== false });
    await AuditLog.create({ actor: req.user.id, action: "geofence.created", targetType: "zone", targetId: zone._id.toString(), details: { name: zone.name, zone_type: zone.zone_type } });
    res.status(201).json(zone);
  } catch { res.status(500).json({ error: "Could not save geofence in MongoDB" }); }
});
router.patch("/:id", async (req, res) => {
  if (req.user.role !== "admin" || req.user.adminRole === "responder") return res.status(403).json({ error: "Monitoring officer access required" });
  try {
    const updates = {};
    if (typeof req.body.is_active === "boolean") updates.is_active = req.body.is_active;
    if (typeof req.body.name === "string" && req.body.name.trim()) updates.name = req.body.name.trim().slice(0, 120);
    const zone = await Zone.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!zone) return res.status(404).json({ error: "Geofence not found" });
    await AuditLog.create({ actor: req.user.id, action: "geofence.updated", targetType: "zone", targetId: zone._id.toString(), details: Object.keys(updates) });
    res.json(zone);
  } catch { res.status(400).json({ error: "Could not update geofence" }); }
});
router.delete("/:id", async (req, res) => {
  if (req.user.role !== "admin" || req.user.adminRole === "responder") return res.status(403).json({ error: "Monitoring officer access required" });
  const zone = await Zone.findByIdAndUpdate(req.params.id, { $set: { is_active: false } }, { new: true });
  if (!zone) return res.status(404).json({ error: "Geofence not found" });
  await AuditLog.create({ actor: req.user.id, action: "geofence.deactivated", targetType: "zone", targetId: zone._id.toString(), details: { name: zone.name } });
  res.json({ success: true, zone });
});
module.exports = router;
