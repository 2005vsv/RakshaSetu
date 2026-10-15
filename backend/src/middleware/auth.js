const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
  const token = bearer || cookies.safevoyage_session;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    req.user = payload;
    User.findById(payload.id).select("role adminRole accountStatus sessionVersion").then((user) => {
      if (!user || user.accountStatus !== "active") return res.status(401).json({ error: "This account is inactive. Contact an administrator." });
      if ((payload.sessionVersion || 0) !== (user.sessionVersion || 0)) return res.status(401).json({ error: "Session expired. Please sign in again." });
      req.user.role = user.role;
      req.user.adminRole = user.adminRole;
      next();
    }).catch(() => res.status(503).json({ error: "Could not verify account status" }));
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
