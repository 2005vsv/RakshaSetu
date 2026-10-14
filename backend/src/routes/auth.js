const router = require("express").Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

const secret = () => process.env.JWT_SECRET || "devsecret";
const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role, email: user.email }, secret(), { expiresIn: "8h" });
const hashPassword = (password) => crypto.scryptSync(password, "safevoyage-v1", 64).toString("hex");
const publicUser = (user) => ({ id: user._id, name: user.name || user.username, email: user.email, role: user.role, digitalId: user.digitalId, preferences: user.preferences });

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role = "user" } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "name, email, and password are required" });
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: "An account with this email already exists" });
    const user = await User.create({ username: email.toLowerCase(), name, email: email.toLowerCase(), password: hashPassword(password), role: role === "admin" ? "admin" : "user", digitalId: `DIG-${crypto.randomBytes(4).toString("hex").toUpperCase()}` });
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (err) { res.status(500).json({ error: "Could not create account" }); }
});

router.post("/tourist-session", async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!email) return res.status(400).json({ error: "email is required" });
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) user = await User.create({ username: email.toLowerCase(), name: name || "Tourist", email: email.toLowerCase(), password: hashPassword(crypto.randomBytes(24).toString("hex")), digitalId: `DIG-${crypto.randomBytes(4).toString("hex").toUpperCase()}` });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (err) { res.status(500).json({ error: "Could not start tourist session" }); }
});

router.get("/me", require("../middleware/auth"), async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

router.patch("/me", require("../middleware/auth"), async (req, res) => {
  const updates = {};
  if (typeof req.body.name === "string") updates.name = req.body.name.trim();
  if (req.body.preferences) updates.preferences = { locationSharing: Boolean(req.body.preferences.locationSharing) };
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
  res.json(publicUser(user));
});

// Simple admin login using env vars (replace with real user DB later)
router.post("/login", async (req, res) => {
  const { email, username, password } = req.body;
  const identity = (email || username || "").toLowerCase();
  const user = await User.findOne({ $or: [{ email: identity }, { username: identity }] });
  if (!user || !password || !crypto.timingSafeEqual(Buffer.from(user.password), Buffer.from(hashPassword(password)))) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: tokenFor(user), user: publicUser(user) });
});

module.exports = router;
