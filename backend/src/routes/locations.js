const router = require("express").Router();
const Location = require("../models/Location");
const auth = require("../middleware/auth");
const Zone = require("../models/Zone");
const Alert = require("../models/Alert");
const { contains } = require("../utils/polygon");
const rateLimit = require("express-rate-limit").rateLimit;
const locationLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Location updates are arriving too quickly. Try again shortly." } });

router.use(auth);

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const points = await Location.find({ user: req.user.id }).sort({ recordedAt: -1 }).limit(limit).lean();
    res.json(points);
  } catch (error) {
    res.status(500).json({ error: "Could not load saved locations" });
  }
});

router.post("/", locationLimiter, async (req, res) => {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.user.id).select("preferences");
    if (!user || !user.preferences?.locationSharing) return res.status(403).json({ error: "Enable location sharing in privacy settings before sending coordinates" });
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (req.body.latitude == null || req.body.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return res.status(400).json({ error: "Valid latitude and longitude are required" });
    }
    const recordedAt = req.body.recordedAt ? new Date(req.body.recordedAt) : new Date();
    if (Number.isNaN(recordedAt.getTime()) || recordedAt.getTime() > Date.now() + 60_000) return res.status(400).json({ error: "Location timestamp is invalid or in the future" });
    const accuracy = req.body.accuracy == null ? null : Number(req.body.accuracy);
    const speed = req.body.speed == null ? null : Number(req.body.speed);
    if ((accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1_000_000)) || (speed !== null && (!Number.isFinite(speed) || speed < 0 || speed > 200))) return res.status(400).json({ error: "Accuracy or speed value is invalid" });
    const point = await Location.create({
      user: req.user.id,
      latitude,
      longitude,
      accuracy,
      speed,
      recordedAt,
    });
    const zones = await Zone.find({ is_active: true }).lean();
    const warnings = [];
    for (const zone of zones) {
      const inside = contains([longitude, latitude], zone.geometry);
      const open = await Alert.findOne({ user: req.user.id, geofenceZone: zone._id, is_resolved: false });
      if (inside && zone.zone_type !== "safe" && !open) {
        const alert = await Alert.create({ user: req.user.id, geofenceZone: zone._id, type: "geofence", severity: zone.zone_type === "restricted" ? "high" : "medium", message: `Entered ${zone.zone_type} area: ${zone.name}`, geoLocation: { type: "Point", coordinates: [longitude, latitude] } });
        warnings.push({ ...alert.toObject(), zone_name: zone.name, zone_type: zone.zone_type });
        req.app.get("io")?.to("admins").emit("alert:new", { alert: warnings[warnings.length - 1] });
      } else if (!inside && open) {
        open.is_resolved = true;
        await open.save();
        req.app.get("io")?.to("admins").emit("alert:updated", { alert: open.toObject() });
      } else if (inside && open) warnings.push({ ...open.toObject(), zone_name: zone.name, zone_type: zone.zone_type });
    }
    if (user.preferences?.shareWithPolice) req.app.get("io")?.to("admins").emit("location:update", { userId: req.user.id, latitude: point.latitude, longitude: point.longitude, recordedAt: point.recordedAt });
    res.status(201).json({ ...point.toObject(), alerts: warnings });
  } catch (error) {
    res.status(400).json({ error: "Could not save this location" });
  }
});

module.exports = router;
