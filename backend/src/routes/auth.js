const router = require("express").Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit").rateLimit;
const AuditLog = require("../models/AuditLog");
const authAttempts = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many account requests. Wait 15 minutes and try again." } });
const recordFailedLogin = async (identity) => AuditLog.create({ action: "auth.failed", targetType: "account-hash", details: { identityHash: crypto.createHash("sha256").update(String(identity || "").trim().toLowerCase()).digest("hex").slice(0, 16) } }).catch(() => {});

const secret = () => process.env.JWT_SECRET || "devsecret";
const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role, email: user.email, sessionVersion: user.sessionVersion || 0 }, secret(), { expiresIn: "30d" });
const hashPassword = (password) => bcrypt.hash(String(password), 12);
const passwordMatches = async (password, encoded) => {
  if (String(encoded || "").startsWith("$2")) return bcrypt.compare(String(password), encoded);
  const legacy = crypto.scryptSync(String(password), "safevoyage-v1", 64).toString("hex");
  return encoded?.length === legacy.length && crypto.timingSafeEqual(Buffer.from(encoded), Buffer.from(legacy));
};
const publicUser = (user) => ({
  id: user._id,
  name: user.name || user.username,
  email: user.email,
  role: user.role,
  adminRole: user.role === "admin" ? user.adminRole : undefined,
  accountStatus: user.accountStatus || "active",
  phone: user.phone || "",
  aadhaarNumber: user.aadhaarNumber || "",
  touristRole: user.touristRole || "tourist",
  digitalId: user.digitalId,
  emergencyContacts: user.emergencyContacts || [],
  preferences: user.preferences
});
const issueSession = (res, user) => {
  const token = tokenFor(user);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `safevoyage_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`);
  return { user: publicUser(user) };
};
const demosEnabled = () => process.env.DEMO_ACCOUNTS_ENABLED === "true" || process.env.NODE_ENV !== "production";
const ensureDemoAccount = async (role) => {
  const admin = role === "admin";
  const email = String(process.env[admin ? "DEMO_ADMIN_EMAIL" : "DEMO_TOURIST_EMAIL"] || (admin ? "admin.demo@safevoyage.local" : "tourist.demo@safevoyage.local")).trim().toLowerCase();
  let user = await User.findOne({ email });
  if (user) {
    if ((user.role === "admin") !== admin) throw new Error("Configured demo account has a conflicting role");
    return user;
  }
  try {
    user = await User.create({
      username: email, email, role: admin ? "admin" : "user", ...(admin ? { adminRole: "super_admin" } : {}),
      name: admin ? "RakshaSetu Demo Administrator" : "RakshaSetu Demo Tourist",
      password: await hashPassword(crypto.randomBytes(32).toString("hex")),
      ...(admin ? {} : {
        touristRole: "tourist",
        digitalId: `DIG-DEMO-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      }),
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    user = await User.findOne({ email });
  }
  if (!user || (user.role === "admin") !== admin) throw new Error("Could not provision the configured demo account");
  return user;
};

router.post("/register", authAttempts, async (req, res) => {
  try {
    const { name, email, password, phone = "", aadhaarNumber = "", touristRole = "tourist", emergencyContacts = [], preferences = {} } = req.body;
    if (req.body.role && req.body.role !== "user") return res.status(403).json({ error: "Administrator accounts can only be provisioned by an administrator" });
    if (!name || !email || !password) return res.status(400).json({ error: "name, email, and password are required" });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database is unavailable. Check Atlas network access and try again." });
    if (String(password).length < 8 || String(password).length > 128) return res.status(400).json({ error: "Password must contain 8–128 characters" });
    if (!Array.isArray(emergencyContacts) || !emergencyContacts.some((contact) => contact.name?.trim() && contact.phone?.trim() && contact.relation?.trim())) return res.status(400).json({ error: "Add at least one personal emergency contact with a name, phone, and relation" });
    if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: "Phone number must contain 10 digits" });
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) return res.status(400).json({ error: "Aadhaar number must contain 12 digits" });
    if (!/^\S+@\S+\.\S+$/.test(String(email))) return res.status(400).json({ error: "Enter a valid email address" });
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: "An account with this email already exists" });
    const user = await User.create({
      username: email.trim().toLowerCase(),
      name,
      email: email.trim().toLowerCase(),
      password: await hashPassword(password),
      role: "user",
      phone,
      aadhaarNumber,
      touristRole: touristRole === "guide" ? "guide" : "tourist",
      emergencyContacts,
      preferences,
      digitalId: `DIG-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
    });
    req.app.get("io")?.to("admins").emit("tourist:registered", { touristId: user._id, createdAt: user.createdAt });
    res.status(201).json(issueSession(res, user));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "An account with this email already exists" });
    if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
    console.error("Tourist registration failed:", err.message);
    res.status(500).json({ error: "Could not create account" });
  }
});

router.post("/tourist-login", authAttempts, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database is unavailable. Check Atlas network access and try again." });
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });
    if (!user || user.role !== "user" || user.accountStatus !== "active" || !password || !(await passwordMatches(password, user.password))) {
      await recordFailedLogin(email);
      return res.status(401).json({ error: "Email or password is incorrect" });
    }
    if (!user.password.startsWith("$2")) { user.password = await hashPassword(password); await user.save(); }
    res.json(issueSession(res, user));
  } catch (err) {
    console.error("Tourist sign-in failed:", err.message);
    res.status(500).json({ error: "Could not sign in" });
  }
});

router.get("/me", require("../middleware/auth"), async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database is unavailable. Check Atlas network access and try again." });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

router.patch("/me", require("../middleware/auth"), async (req, res) => {
  const updates = {};
  if (typeof req.body.name === "string") updates.name = req.body.name.trim();
  if (typeof req.body.phone === "string") updates.phone = req.body.phone.trim();
  if (typeof req.body.aadhaarNumber === "string") updates.aadhaarNumber = req.body.aadhaarNumber.trim();
  if (req.body.touristRole) updates.touristRole = req.body.touristRole === "guide" ? "guide" : "tourist";
  if (Array.isArray(req.body.emergencyContacts)) updates.emergencyContacts = req.body.emergencyContacts;
  if (req.body.preferences) {
    updates.preferences = {
      notifications: Boolean(req.body.preferences.notifications),
      locationSharing: Boolean(req.body.preferences.locationSharing),
      shareWithPolice: Boolean(req.body.preferences.shareWithPolice)
    };
    if (updates.preferences.locationSharing === false || updates.preferences.shareWithPolice === false) {
      const io = req.app.get("io");
      io?.to("admins").emit("location:sharing-stopped", { userId: req.user.id });
    }
  }
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

// Simple admin login using env vars (replace with real user DB later)
router.post("/login", authAttempts, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database is unavailable. Check Atlas network access and try again." });
  const { email, username, password } = req.body;
  const identity = String(email || username || "").trim().toLowerCase();
  const user = await User.findOne({ $or: [{ email: identity }, { username: identity }] });
  if (!user || user.role !== "admin" || user.accountStatus !== "active" || !password || !(await passwordMatches(password, user.password))) { await recordFailedLogin(identity); return res.status(401).json({ error: "Invalid credentials" }); }
  if (!user.password.startsWith("$2")) { user.password = await hashPassword(password); await user.save(); }
  res.json(issueSession(res, user));
});

router.post("/demo-login", authAttempts, async (req, res) => {
  try {
    if (!demosEnabled()) return res.status(404).json({ error: "Demo sign-in is disabled" });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database is unavailable. Check Atlas access and try again." });
    const role = req.body.role === "admin" ? "admin" : req.body.role === "tourist" ? "user" : null;
    if (!role) return res.status(400).json({ error: "Choose the tourist or admin demo account" });
    const user = await ensureDemoAccount(role);
    res.json(issueSession(res, user));
  } catch (error) {
    console.error("Demo sign-in failed:", error.message);
    res.status(500).json({ error: "Could not open the demo account" });
  }
});

router.post("/forgot-password", authAttempts, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  const smtpReady = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM;
  if (!smtpReady) return res.status(503).json({ error: "Password recovery email is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and MAIL_FROM." });
  try {
    const user = await User.findOne({ email, accountStatus: "active" });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
      user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      const nodemailer = require("nodemailer");
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      const origin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
      try {
        await transport.sendMail({ from: process.env.MAIL_FROM, to: user.email, subject: "Reset your RakshaSetu password", text: `Use this one-time link within 30 minutes: ${origin}/reset-password/${token}\nIf you did not request this, ignore this message.` });
      } catch (error) {
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        throw error;
      }
    }
    res.json({ message: "If an active account uses that email, a password reset link has been sent." });
  } catch (error) {
    console.error("Password recovery delivery failed:", error.message);
    res.status(503).json({ error: "Could not deliver password reset email. Check the configured mail service and try again." });
  }
});

router.post("/reset-password", authAttempts, async (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (token.length !== 64 || password.length < 8) return res.status(400).json({ error: "A valid reset link and password of at least 8 characters are required" });
  try {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({ passwordResetTokenHash: hash, passwordResetExpires: { $gt: new Date() }, accountStatus: "active" }).select("+passwordResetTokenHash +passwordResetExpires");
    if (!user) return res.status(400).json({ error: "This password reset link is invalid or expired" });
    user.password = await hashPassword(password);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.json({ message: "Password updated. Sign in with your new password." });
  } catch { res.status(500).json({ error: "Could not update password" }); }
});

router.get("/demo-status", (_req, res) => res.json({ enabled: demosEnabled() }));

router.post("/logout", (_req, res) => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `safevoyage_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
  res.json({ success: true });
});

module.exports = router;
