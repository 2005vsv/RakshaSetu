const router = require("express").Router();
const Trip = require("../models/Trip");
const auth = require("../middleware/auth");

router.get("/", auth, async (req, res) => res.json(await Trip.find({ user: req.user.id }).sort({ createdAt: -1 })));
router.post("/", auth, async (req, res) => {
  if (!req.body.destination?.trim()) return res.status(400).json({ error: "destination is required" });
  res.status(201).json(await Trip.create({ user: req.user.id, destination: req.body.destination, startDate: req.body.startDate, endDate: req.body.endDate, status: req.body.status || "active" }));
});
module.exports = router;
