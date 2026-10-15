const router = require("express").Router();
const ctrl = require("../controllers/alertsController");
const auth = require("../middleware/auth");

router.get("/", auth, ctrl.listAlerts);
router.post("/", auth, ctrl.createAlert);
router.put("/geo/:id/resolve", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Administrator access required" });
  if (req.user.adminRole === "responder") return res.status(403).json({ error: "Monitoring officer access required" });
  try {
    const Alert = require("../models/Alert");
    const alert = await Alert.findByIdAndUpdate(req.params.id, { $set: { is_resolved: true } }, { new: true });
    if (!alert) return res.status(404).json({ error: "Geofence alert not found" });
    req.app.get("io")?.to("admins").emit("alert:updated", { alert });
    res.json({ ...alert.toObject(), status: "resolved" });
  } catch { res.status(500).json({ error: "Could not resolve geofence alert" }); }
});
router.put("/:id/assign", auth, ctrl.assignAlert);
router.put("/:id/resolve", auth, (req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ error: "Administrator access required" }), ctrl.resolveAlert);

module.exports = router;
