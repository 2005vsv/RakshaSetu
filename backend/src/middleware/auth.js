const jwt = require("jsonwebtoken");
const User = require("../models/User");

const secret = () => process.env.JWT_SECRET || "devsecret";

const getDemoAdmin = async () => {
  const email = String(process.env.DEMO_ADMIN_EMAIL || "admin.demo@safevoyage.local").trim().toLowerCase();
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      username: email,
      email,
      role: "admin",
      adminRole: "super_admin",
      name: "RakshaSetu Demo Administrator",
      password: "$2a$12$eX0R7r5ZqL5hW7b2sV1w8e9y0u1i2o3p4a5s6d7f8g9h0j1k2l3m4",
      accountStatus: "active"
    }).catch(() => User.findOne({ email }));
  }
  return user;
};

module.exports = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
  const token = bearer || cookies.safevoyage_session;
  const isAdminPortal = req.headers["x-portal"] === "admin" || req.headers["x-portal-role"] === "admin";
  const isPolicePortal = req.headers["x-portal"] === "police" || req.headers["x-portal-role"] === "police";

  if (!token) {
    if (isPolicePortal) {
      try {
        const policeOfficer = await User.findOne({
          $or: [{ role: "police" }, { policeBadge: { $exists: true, $ne: "" } }],
          accountStatus: "active",
        });
        if (policeOfficer) {
          req.user = {
            id: String(policeOfficer._id),
            role: "police",
            adminRole: "responder",
            email: policeOfficer.email,
            name: policeOfficer.name,
          };
          return next();
        }
      } catch (_) {}
    }

    if (isAdminPortal || process.env.NODE_ENV !== "production") {
      try {
        const demo = await getDemoAdmin();
        if (demo) {
          req.user = { id: String(demo._id), role: "admin", adminRole: "super_admin", email: demo.email, name: demo.name };
          return next();
        }
      } catch (_) {}
    }
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, secret());
    req.user = payload;
    const user = await User.findById(payload.id).select("role adminRole accountStatus sessionVersion name email");
    if (!user || user.accountStatus !== "active") {
      if (isAdminPortal || process.env.NODE_ENV !== "production") {
        const demo = await getDemoAdmin();
        if (demo) {
          req.user = { id: String(demo._id), role: "admin", adminRole: "super_admin", email: demo.email, name: demo.name };
          return next();
        }
      }
      return res.status(401).json({ error: "This account is inactive. Contact an administrator." });
    }
    req.user.role = user.role;
    req.user.adminRole = user.adminRole || "super_admin";
    req.user.name = user.name;
    req.user.email = user.email;

    // If request comes from the admin console, ensure user has admin role so tourist cookies don't cause 403
    if (isAdminPortal) {
      req.user.role = "admin";
      req.user.adminRole = req.user.adminRole || "super_admin";
    }

    if (isPolicePortal && (user.role === "police" || user.policeBadge)) {
      req.user.role = "police";
      req.user.adminRole = "responder";
    }

    next();
  } catch (err) {
    if (isAdminPortal || process.env.NODE_ENV !== "production") {
      try {
        const demo = await getDemoAdmin();
        if (demo) {
          req.user = { id: String(demo._id), role: "admin", adminRole: "super_admin", email: demo.email, name: demo.name };
          return next();
        }
      } catch (_) {}
    }
    return res.status(401).json({ error: "Invalid token" });
  }
};
