const router = require("express").Router();
const Trip = require("../models/Trip");
const auth = require("../middleware/auth");

router.get("/", auth, async (req, res) => res.json(await Trip.find({ user: req.user.id }).sort({ createdAt: -1 })));
router.post("/", auth, async (req, res) => {
  if (!req.body.destination?.trim() || !req.body.startPoint?.trim()) return res.status(400).json({ error: "startPoint and destination are required" });
  if (req.body.endDate && req.body.startDate && new Date(req.body.endDate) < new Date(req.body.startDate)) return res.status(400).json({ error: "endDate must be on or after startDate" });
  const trip = await Trip.create({
    user: req.user.id,
    startPoint: req.body.startPoint || "",
    destination: req.body.destination,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    modeOfTravel: req.body.modeOfTravel || "other",
    description: req.body.description || "",
    additionalDestinations: Array.isArray(req.body.additionalDestinations) ? req.body.additionalDestinations : [],
    status: req.body.status || "active"
  });
  req.app.get("io")?.to("admins").emit("trip:updated", { userId: req.user.id, status: trip.status });
  res.status(201).json(trip);
});
router.patch("/:id", auth, async (req, res) => {
  const allowed = {};
  for (const key of ["startPoint", "destination", "startDate", "endDate", "modeOfTravel", "description", "additionalDestinations", "status"]) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }
  if (allowed.status && !["planned", "active", "completed"].includes(allowed.status)) return res.status(400).json({ error: "Invalid trip status" });
  if (allowed.endDate && allowed.startDate && new Date(allowed.endDate) < new Date(allowed.startDate)) return res.status(400).json({ error: "endDate must be on or after startDate" });
  const trip = await Trip.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { $set: allowed }, { new: true, runValidators: true });
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  req.app.get("io")?.to("admins").emit("trip:updated", { userId: req.user.id, status: trip.status });
  res.json(trip);
});
router.delete("/:id", auth, async (req, res) => {
  const trip = await Trip.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  req.app.get("io")?.to("admins").emit("trip:updated", { userId: req.user.id, deleted: true });
  res.json({ success: true });
});
module.exports = router;
