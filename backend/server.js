const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./src/models/User");
const SystemSetting = require("./src/models/SystemSetting");
const Location = require("./src/models/Location");
const Incident = require("./src/models/Incident");
const Alert = require("./src/models/Alert");
const AuditLog = require("./src/models/AuditLog");

dotenv.config();
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error("Set a private JWT_SECRET containing at least 32 characters before starting production");
}
const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_ORIGIN || ["http://localhost:3000", "http://127.0.0.1:3000"], credentials: true },
});
app.set("io", io);
const applyRetentionPolicy = async () => {
  if (mongoose.connection.readyState !== 1) return;
  const settings = await SystemSetting.findOne({ key: "global" }).lean();
  if (!settings) return;
  const expiresBefore = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [locations, incidents, alerts, audit] = await Promise.all([
    settings.locationRetentionDays ? Location.deleteMany({ recordedAt: { $lt: expiresBefore(settings.locationRetentionDays) } }) : { deletedCount: 0 },
    settings.incidentRetentionDays ? Incident.deleteMany({ createdAt: { $lt: expiresBefore(settings.incidentRetentionDays) } }) : { deletedCount: 0 },
    settings.alertRetentionDays ? Alert.deleteMany({ createdAt: { $lt: expiresBefore(settings.alertRetentionDays) } }) : { deletedCount: 0 },
    settings.auditRetentionDays ? AuditLog.deleteMany({ createdAt: { $lt: expiresBefore(settings.auditRetentionDays) } }) : { deletedCount: 0 },
  ]);
  const removed = { locations: locations.deletedCount || 0, incidents: incidents.deletedCount || 0, alerts: alerts.deletedCount || 0, auditLogs: audit.deletedCount || 0 };
  if (Object.values(removed).some(Boolean)) await AuditLog.create({ actor: settings.updatedBy, action: "system.retention_applied", targetType: "system", targetId: "global", details: removed });
};
const retentionTimer = setInterval(() => applyRetentionPolicy().catch((error) => console.error("Retention policy could not be applied:", error.message)), 24 * 60 * 60 * 1000);
retentionTimer.unref();
io.use(async (socket, next) => {
  try {
    const rawCookie = String(socket.handshake.headers.cookie || "");
    const value = rawCookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("safevoyage_session="))?.slice("safevoyage_session=".length);
    const authHeader = String(socket.handshake.headers.authorization || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const token = socket.handshake.auth?.token || bearerToken || (value ? decodeURIComponent(value) : "");
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
        const user = await User.findById(payload.id).select("role adminRole accountStatus sessionVersion");
        if (user && user.accountStatus === "active") {
          socket.user = { id: String(user._id), role: user.role, adminRole: user.adminRole };
        }
      } catch (_) {}
    }
    next();
  } catch { next(); }
});
io.on("connection", (socket) => {
  if (socket.user) {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === "admin" && socket.user.adminRole !== "responder") socket.join("admins");
    if (socket.user.role === "admin" && socket.user.adminRole === "responder") socket.join(`responder:${socket.user.id}`);
    if (socket.user.role === "police" || socket.user.adminRole === "police" || socket.user.adminRole === "responder") {
      socket.join("police");
      socket.join(`police:${socket.user.id}`);
    }
  }
  socket.on("join:admins", () => socket.join("admins"));
  socket.on("join:police", (data) => {
    socket.join("police");
    if (data?.officerId) socket.join(`police:${data.officerId}`);
  });
});
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
}));
app.use(express.json());

// Routes placeholder
app.get("/", (req, res) => res.send("Backend running"));

// mount new routes
const authRoutes = require("./src/routes/auth");
const alertsRoutes = require("./src/routes/alerts");
const efirRoutes = require("./src/routes/efir");
const inspectorsRoutes = require("./src/routes/inspectors");
const tripsRoutes = require("./src/routes/trips");
const locationsRoutes = require("./src/routes/locations");
const incidentsRoutes = require("./src/routes/incidents");
const adminRoutes = require("./src/routes/admin");
const zonesRoutes = require("./src/routes/zones");
const supportRoutes = require("./src/routes/support");
const verifyRoutes = require("./src/routes/verify");
const chatRoutes = require("./src/routes/chat");
const anomaliesRoutes = require("./src/routes/anomalies");
const policeRoutes = require("./src/routes/police");
const authMiddleware = require("./src/middleware/auth");
const Announcement = require("./src/models/Announcement");

app.use("/auth", authRoutes);
app.use("/alerts", alertsRoutes);
app.use("/efir", efirRoutes);
app.use("/inspectors", inspectorsRoutes);
app.use("/trips", tripsRoutes);
app.use("/locations", locationsRoutes);
app.use("/incidents", incidentsRoutes);
app.use("/admin", adminRoutes);
app.use("/zones", zonesRoutes);
app.use("/support", supportRoutes);
app.use("/verify", verifyRoutes);
app.use("/chat", chatRoutes);
app.use("/anomalies", anomaliesRoutes);
app.use("/police", policeRoutes);
app.get("/announcements", authMiddleware, async (_req, res) => {
  try { res.json(await Announcement.find({ published: true }).sort({ createdAt: -1 }).limit(50).lean()); }
  catch { res.status(500).json({ error: "Could not load safety announcements" }); }
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err.message);
  res.status(500).json({ error: "The request could not be completed" });
});

const port = Number(process.env.PORT || 5000);
server.listen(port, () => console.log(`Server listening on ${port}; waiting for MongoDB`));

const connectWithRetry = () => {
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
  })
    .then(async () => {
      await User.updateMany({ accountStatus: { $exists: false } }, { $set: { accountStatus: "active" } });
      await User.updateMany({ role: "admin", adminRole: { $exists: false } }, { $set: { adminRole: "super_admin" } });
      await User.updateMany({ role: "user", verificationStatus: { $exists: false } }, { $set: { verificationStatus: "unverified", flagReason: "" } });
      await User.updateMany({ sessionVersion: { $exists: false } }, { $set: { sessionVersion: 0 } });
      await User.updateMany({ "preferences.notifications": { $exists: false } }, { $set: { "preferences.notifications": true } });
      await User.updateMany({ "preferences.locationSharing": { $exists: false } }, { $set: { "preferences.locationSharing": false } });
      await User.updateMany({ "preferences.shareWithPolice": { $exists: false } }, { $set: { "preferences.shareWithPolice": true } });
      console.log("MongoDB Connected; legacy account fields migrated");
      await applyRetentionPolicy();
    })
    .catch((err) => {
      console.error(`MongoDB connection failed: ${err.message}. Retrying in 4s...`);
      setTimeout(connectWithRetry, 4000);
    });
};
connectWithRetry();

mongoose.connection.on("connected", () => console.log("MongoDB connection restored"));
mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected; database routes will be unavailable until reconnection"));

app.get("/health", (_req, res) => res.status(200).json({
  status: "ok",
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
}));

const shutdown = () => {
  clearInterval(retentionTimer);
  server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
