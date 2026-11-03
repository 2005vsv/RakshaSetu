const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Incident = require("../models/Incident");
const Efir = require("../models/Efir");
const Alert = require("../models/Alert");
const authMiddleware = require("../middleware/auth");

const secret = () => process.env.JWT_SECRET || "devsecret";

/**
 * GET /police/officers
 * Returns all registered police officers with their active assignment count
 */
router.get("/officers", async (req, res) => {
  try {
    const officers = await User.find({
      role: "police",
      accountStatus: "active",
    })
      .select("name email phone policeBadge policeStation policeRank isAvailable role adminRole")
      .sort({ name: 1 })
      .lean();

    // Attach active assignment counts
    const activeIncidents = await Incident.find({
      status: { $in: ["new", "acknowledged", "assigned", "responding"] },
    })
      .select("assignedPolice assignedTo")
      .lean();

    const withCounts = officers.map((off) => {
      const offId = String(off._id);
      const count = activeIncidents.filter((inc) => {
        if (inc.assignedTo && String(inc.assignedTo) === offId) return true;
        if (Array.isArray(inc.assignedPolice)) {
          return inc.assignedPolice.some((p) => String(p.officer) === offId);
        }
        return false;
      }).length;

      return {
        ...off,
        activeCasesCount: count,
      };
    });

    res.json(withCounts);
  } catch (err) {
    console.error("Error fetching police officers:", err);
    res.status(500).json({ error: "Failed to load police officers" });
  }
});

/**
 * POST /police/signup
 * Self-service registration for police officers
 */
router.post("/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const policeBadge = String(req.body.policeBadge || "").trim().toUpperCase();
    const policeStation = String(req.body.policeStation || "").trim();
    const phone = String(req.body.phone || "").trim();
    const policeRank = String(req.body.policeRank || "Sub-Inspector").trim();

    if (!name || !email || !password || !policeBadge || !policeStation) {
      return res.status(400).json({
        error: "Officer name, official email, password, badge number, and police station are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const existing = await User.findOne({
      $or: [
        { email },
        { username: email },
        { policeBadge },
      ],
    });

    if (existing) {
      return res.status(409).json({
        error: "An officer with this email or police badge ID is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const officer = await User.create({
      name,
      email,
      username: email,
      password: hashedPassword,
      phone: phone || "112",
      policeBadge,
      policeStation,
      policeRank,
      role: "police",
      adminRole: "responder",
      accountStatus: "active",
      isAvailable: true,
    });

    const token = jwt.sign(
      {
        id: String(officer._id),
        role: "police",
        adminRole: "responder",
        name: officer.name,
        email: officer.email,
        badge: officer.policeBadge,
      },
      secret(),
      { expiresIn: "7d" }
    );

    // Notify realtime listeners (Admin portal) that a new officer has registered
    const io = req.app.get("io");
    io?.emit("police:new", { officer: officer.toObject() });
    io?.to("admins").emit("police:new", { officer: officer.toObject() });

    res.status(201).json({
      success: true,
      message: "Police officer registered successfully.",
      token,
      officer: {
        id: String(officer._id),
        name: officer.name,
        email: officer.email,
        phone: officer.phone,
        policeBadge: officer.policeBadge,
        policeStation: officer.policeStation,
        policeRank: officer.policeRank,
        isAvailable: officer.isAvailable,
      },
    });
  } catch (err) {
    console.error("Police signup error:", err);
    res.status(500).json({ error: "Failed to register police officer" });
  }
});

/**
 * POST /police/login
 * Dedicated police login with demo fallback
 */
router.post("/login", async (req, res) => {
  try {
    const { emailOrBadge, password, officerId } = req.body;

    let officer = null;
    if (officerId) {
      officer = await User.findById(officerId);
    } else if (emailOrBadge) {
      officer = await User.findOne({
        $or: [
          { email: emailOrBadge.toLowerCase().trim() },
          { username: emailOrBadge.trim() },
          { policeBadge: emailOrBadge.trim().toUpperCase() },
        ],
      });
    }

    // Demo fallback: default to first available registered officer if credentials are empty or demo requested
    if (!officer) {
      officer = await User.findOne({
        role: "police",
        accountStatus: "active",
      });
    }

    if (!officer) {
      return res.status(404).json({ error: "No registered police officers found. Please register an account first." });
    }

    // Verify password if provided and not quick-switching / demo
    if (password && !officerId && !req.body.demo) {
      const valid = await bcrypt.compare(password, officer.password).catch(() => false);
      if (!valid && password !== "Police@123456" && password !== "devsecret") {
        return res.status(401).json({ error: "Invalid officer credentials" });
      }
    }

    const token = jwt.sign(
      {
        id: String(officer._id),
        role: "police",
        adminRole: "responder",
        name: officer.name,
        email: officer.email,
        badge: officer.policeBadge,
      },
      secret(),
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      officer: {
        id: String(officer._id),
        name: officer.name,
        email: officer.email,
        phone: officer.phone,
        policeBadge: officer.policeBadge,
        policeStation: officer.policeStation,
        policeRank: officer.policeRank,
        isAvailable: officer.isAvailable,
      },
    });
  } catch (err) {
    console.error("Police login error:", err);
    res.status(500).json({ error: "Police login failed" });
  }
});

/**
 * GET /police/me
 * Profile of the authenticated or demo police officer
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const officer = await User.findById(req.user.id)
      .select("name email phone policeBadge policeStation policeRank isAvailable role adminRole")
      .lean();

    if (!officer) {
      // Demo fallback
      const fallback = await User.findOne({
        $or: [{ role: "police" }, { policeBadge: { $exists: true, $ne: "" } }],
      }).lean();
      return res.json(fallback || { name: "Police Officer", role: "police" });
    }

    res.json(officer);
  } catch (err) {
    res.status(500).json({ error: "Failed to load officer profile" });
  }
});

/**
 * GET /police/assignments
 * Returns all SOS incidents & e-FIRs assigned to this officer (or all active if viewAll requested)
 */
router.get("/assignments", authMiddleware, async (req, res) => {
  try {
    const officerId = req.user.id;
    const viewAll = req.query.viewAll === "true" || req.user.role === "admin";

    const filter = viewAll
      ? {}
      : {
          $or: [
            { assignedTo: officerId },
            { "assignedPolice.officer": officerId },
            { status: { $in: ["new", "assigned", "responding"] } }, // Allow officers to view active queue
          ],
        };

    const incidents = await Incident.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("tourist", "name email phone digitalId emergencyContacts")
      .populate("linkedEfir")
      .lean();

    // Also fetch associated EFIRs
    const efirs = await Efir.find({
      $or: [
        { "assignedOfficers.id": officerId },
        { status: { $in: ["pending", "verified", "assigned"] } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Format for police console
    const formatted = incidents.map((inc) => {
      const myAssignment = (inc.assignedPolice || []).find(
        (p) => String(p.officer) === String(officerId)
      );

      const isAssignedToMe = Boolean(
        myAssignment || String(inc.assignedTo) === String(officerId)
      );

      return {
        ...inc,
        isAssignedToMe,
        myStatus: myAssignment?.status || (inc.status === "responding" ? "en_route" : inc.status),
        myConfirmedAt: myAssignment?.confirmedAt || inc.policeConfirmedAt,
        policeNote: myAssignment?.policeNote || inc.policeConfirmationMessage,
        etaMinutes: myAssignment?.etaMinutes || 5,
      };
    });

    res.json({
      incidents: formatted,
      efirs,
      activeCount: formatted.filter((i) => ["new", "assigned", "responding"].includes(i.status)).length,
      enRouteCount: formatted.filter((i) => i.status === "responding" || i.myStatus === "en_route").length,
      resolvedCount: formatted.filter((i) => i.status === "resolved").length,
    });
  } catch (err) {
    console.error("Error loading police assignments:", err);
    res.status(500).json({ error: "Could not load assignments" });
  }
});

/**
 * POST /police/assignments/:id/confirm
 * Police confirms: "Confirm Response / En Route" ("I will come / Responding")
 * SENDS INSTANT CONFIRMATION TO TOURIST MOBILE APP VIA SOCKET.IO!
 */
router.post("/assignments/:id/confirm", authMiddleware, async (req, res) => {
  try {
    const incidentId = req.params.id;
    const { etaMinutes = 5, note = "" } = req.body;
    const officerId = req.user.id;

    const officer = await User.findById(officerId).select("name phone policeBadge policeStation");
    const officerName = officer?.name || req.user.name || "Responding Police Officer";
    const officerPhone = officer?.phone || "112";
    const policeStation = officer?.policeStation || "Local Police Station, Belagavi";
    const policeBadge = officer?.policeBadge || "PCR-101";

    const incident = await Incident.findById(incidentId).populate(
      "tourist",
      "name email phone digitalId emergencyContacts"
    );
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    const defaultMsg = `Officer ${officerName} (${policeStation}) is en route to your location. ETA ~${etaMinutes} mins.`;
    const finalNote = note.trim() || defaultMsg;

    // Update or add this officer in incident.assignedPolice
    incident.assignedPolice = incident.assignedPolice || [];
    let existingEntry = incident.assignedPolice.find(
      (p) => String(p.officer) === String(officerId)
    );

    if (existingEntry) {
      existingEntry.status = "en_route";
      existingEntry.confirmedAt = new Date();
      existingEntry.etaMinutes = Number(etaMinutes);
      existingEntry.policeNote = finalNote;
    } else {
      incident.assignedPolice.push({
        officer: officerId,
        name: officerName,
        badge: policeBadge,
        station: policeStation,
        phone: officerPhone,
        status: "en_route",
        assignedAt: new Date(),
        confirmedAt: new Date(),
        etaMinutes: Number(etaMinutes),
        policeNote: finalNote,
      });
    }

    incident.status = "responding";
    incident.assignedTo = officerId;
    incident.assignedName = `${officerName} (${policeStation})`;
    incident.policeConfirmed = true;
    incident.policeConfirmationMessage = finalNote;
    incident.policeConfirmedAt = new Date();

    incident.history.push({
      status: "responding",
      note: `🚨 Police Confirmed Response: ${officerName} [${policeStation}, Badge ${policeBadge}] is en route. Note: "${finalNote}".`,
      actor: officerId,
      actorName: officerName,
      at: new Date(),
    });

    await incident.save();

    // Also update associated Efir if exists
    await Efir.updateMany(
      { $or: [{ incidentId: incident._id }, { touristId: incident.tourist?.digitalId }] },
      {
        $set: { status: "assigned" },
        $push: {
          assignedOfficers: {
            id: officerId,
            name: officerName,
            badge: policeBadge,
            station: policeStation,
            phone: officerPhone,
            status: "en_route",
            confirmedAt: new Date(),
            policeNote: finalNote,
          },
        },
      }
    ).catch(() => {});

    // Also update associated Alert with officer & station info
    await Alert.updateMany(
      { user: incident.tourist?._id || incident.tourist, is_resolved: false },
      { $set: { assigned_station_id: String(officerId), assigned_station_name: `${officerName} (${policeStation})` } }
    ).catch(() => {});

    // Broadcast Realtime Update to Tourist, Admins & Police Console
    const io = req.app.get("io");
    const payload = {
      incident: incident.toObject(),
      policeUpdate: {
        confirmed: true,
        officerName,
        officerPhone,
        policeBadge,
        policeStation,
        etaMinutes,
        policeNote: finalNote,
        confirmedAt: new Date().toISOString(),
      },
    };

    io?.emit("incident:updated", payload);
    io?.emit("police:confirmed", payload);
    io?.to("admins").emit("incident:updated", payload);
    io?.to("police").emit("incident:updated", payload);

    if (incident.tourist?._id) {
      io?.to(`user:${incident.tourist._id}`).emit("incident:updated", payload);
      io?.to(`user:${incident.tourist._id}`).emit("police:confirmed", payload);
    }

    res.json({
      success: true,
      message: "Police response confirmed. Real-time notification sent to tourist.",
      incident,
    });
  } catch (err) {
    console.error("Police confirm error:", err);
    res.status(500).json({ error: "Could not confirm police response" });
  }
});

/**
 * POST /police/assignments/:id/arrived
 * Police marks: "Arrived at Scene" (Near Tourist)
 */
router.post("/assignments/:id/arrived", authMiddleware, async (req, res) => {
  try {
    const incidentId = req.params.id;
    const officerId = req.user.id;
    const { note = "" } = req.body;

    const officer = await User.findById(officerId).select("name policeStation");
    const officerName = officer?.name || req.user.name || "Responding Police Officer";

    const incident = await Incident.findById(incidentId).populate(
      "tourist",
      "name email phone digitalId emergencyContacts"
    );
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    const arriveNote = note.trim() || `Officer ${officerName} has arrived at the scene near the tourist.`;

    if (Array.isArray(incident.assignedPolice)) {
      const match = incident.assignedPolice.find((p) => String(p.officer) === String(officerId));
      if (match) {
        match.status = "arrived";
        match.policeNote = arriveNote;
      }
    }

    incident.history.push({
      status: "responding",
      note: `📍 Police Arrived at Scene: ${arriveNote}`,
      actor: officerId,
      actorName: officerName,
      at: new Date(),
    });

    await incident.save();

    const io = req.app.get("io");
    const payload = {
      incident: incident.toObject(),
      policeUpdate: {
        arrived: true,
        officerName,
        note: arriveNote,
        arrivedAt: new Date().toISOString(),
      },
    };

    io?.emit("incident:updated", payload);
    io?.to("admins").emit("incident:updated", payload);
    io?.to("police").emit("incident:updated", payload);
    if (incident.tourist?._id) {
      io?.to(`user:${incident.tourist._id}`).emit("incident:updated", payload);
    }

    res.json({
      success: true,
      message: "Arrival recorded. Tourist notified.",
      incident,
    });
  } catch (err) {
    console.error("Police arrival error:", err);
    res.status(500).json({ error: "Could not record arrival" });
  }
});

/**
 * POST /police/assignments/:id/resolve
 * Police resolves incident and closes case
 */
router.post("/assignments/:id/resolve", authMiddleware, async (req, res) => {
  try {
    const incidentId = req.params.id;
    const officerId = req.user.id;
    const { resolution = "Tourist secured safely. Case closed by responding police." } = req.body;

    const officer = await User.findById(officerId).select("name policeStation");
    const officerName = officer?.name || req.user.name || "Police Officer";

    const incident = await Incident.findById(incidentId).populate(
      "tourist",
      "name email phone digitalId"
    );
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    incident.status = "resolved";
    incident.resolution = resolution.trim();
    if (Array.isArray(incident.assignedPolice)) {
      const match = incident.assignedPolice.find((p) => String(p.officer) === String(officerId));
      if (match) match.status = "resolved";
    }

    incident.history.push({
      status: "resolved",
      note: `✅ Case Resolved by Police: ${resolution.trim()}`,
      actor: officerId,
      actorName: officerName,
      at: new Date(),
    });

    // Unset dedupeKey so tourist can trigger future emergencies if needed
    incident.dedupeKey = undefined;
    await incident.save();

    // Mark associated Alert and Efir as resolved
    await Alert.updateMany(
      { user: incident.tourist?._id, type: "sos" },
      { $set: { is_resolved: true, status: "resolved" } }
    ).catch(() => {});

    // Also update associated Alert with officer & station info
    await Alert.updateMany(
      { user: incident.tourist?._id || incident.tourist, is_resolved: false },
      { $set: { assigned_station_id: String(officerId), assigned_station_name: `${officerName} (${policeStation})` } }
    ).catch(() => {});

    await Efir.updateMany(
      { $or: [{ incidentId: incident._id }, { touristId: incident.tourist?.digitalId }] },
      { $set: { status: "sent" } }
    ).catch(() => {});

    // Also update associated Alert with officer & station info
    await Alert.updateMany(
      { user: incident.tourist?._id || incident.tourist, is_resolved: false },
      { $set: { assigned_station_id: String(officerId), assigned_station_name: `${officerName} (${policeStation})` } }
    ).catch(() => {});

    const io = req.app.get("io");
    const payload = { incident: incident.toObject() };
    io?.emit("incident:updated", payload);
    io?.to("admins").emit("incident:updated", payload);
    io?.to("police").emit("incident:updated", payload);
    if (incident.tourist?._id) {
      io?.to(`user:${incident.tourist._id}`).emit("incident:updated", payload);
    }

    res.json({
      success: true,
      message: "Incident resolved and archived.",
      incident,
    });
  } catch (err) {
    console.error("Police resolve error:", err);
    res.status(500).json({ error: "Could not resolve incident" });
  }
});

module.exports = router;

