const router = require("express").Router();
const auth = require("../middleware/auth");
const SupportRequest = require("../models/SupportRequest");

router.use(auth);

router.get("/", async (req, res) => {
  try {
    res.json(
      await SupportRequest.find({ tourist: req.user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    );
  } catch {
    res.status(500).json({ error: "Could not load support requests" });
  }
});

router.post("/", async (req, res) => {
  const category = ["account", "privacy", "technical", "other"].includes(req.body.category)
    ? req.body.category
    : "other";
  const subject = String(req.body.subject || "").trim();
  const message = String(req.body.message || "").trim();
  if (subject.length < 3 || message.length < 10) {
    return res.status(400).json({ error: "Enter a subject (min 3 chars) and a message (min 10 chars)" });
  }
  try {
    const item = await SupportRequest.create({
      tourist: req.user.id,
      category,
      subject,
      message,
    });
    await item.populate("tourist", "name email phone digitalId");
    const payload = { request: item.toObject() };
    const io = req.app.get("io");
    io?.to("admins").emit("support:new", payload);
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: "Could not submit support request" });
  }
});

module.exports = router;
