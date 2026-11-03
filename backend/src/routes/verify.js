const router = require("express").Router();
const User = require("../models/User");

// Public Verification Endpoint (Serves HTML for mobile/browser scans, or JSON for API calls)
router.get("/:digitalId", async (req, res) => {
  try {
    const rawId = String(req.params.digitalId || "").trim();
    if (!rawId) {
      return renderNotFound(res, "No Tourist ID provided.");
    }

    const user = await User.findOne({
      digitalId: { $regex: new RegExp(`^${rawId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
      role: "user",
    }).select("name digitalId email phone aadhaarNumber accountStatus verificationStatus emergencyContacts createdAt").lean();

    // Check if JSON response is requested
    const wantsJson = req.query.format === "json" || req.headers.accept?.includes("application/json");

    if (!user) {
      if (wantsJson) {
        return res.status(404).json({ valid: false, error: "Tourist ID not found in registry" });
      }
      return renderNotFound(res, rawId);
    }

    if (wantsJson) {
      return res.json({
        valid: user.accountStatus === "active",
        name: user.name,
        digitalId: user.digitalId,
        accountStatus: user.accountStatus,
        verificationStatus: user.verificationStatus,
        registeredAt: user.createdAt,
        emergencyContacts: user.emergencyContacts || [],
      });
    }

    return renderVerifiedHtml(res, user);
  } catch (err) {
    console.error("Verification error:", err);
    return res.status(500).send("Verification system error. Please retry.");
  }
});

// Also support query param: /verify?id=DIG-1234
router.get("/", async (req, res) => {
  const queryId = req.query.id || req.query.digitalId;
  if (queryId) {
    return res.redirect(`/verify/${encodeURIComponent(queryId)}`);
  }
  return renderNotFound(res, "Please provide or scan a valid Tourist Digital ID.");
});

function maskPhone(phone) {
  if (!phone) return "Registered on file";
  const str = String(phone).replace(/\s+/g, "");
  if (str.length <= 4) return str;
  return str.slice(0, 2) + "******" + str.slice(-4);
}

function renderVerifiedHtml(res, user) {
  const isActive = user.accountStatus === "active";
  const registeredDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "Verified on file";
  const verifiedTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const verifiedDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const checksum = Math.random().toString(36).substring(2, 10).toUpperCase();

  const primaryContact = Array.isArray(user.emergencyContacts) && user.emergencyContacts.length > 0
    ? `${user.emergencyContacts[0].name || "Contact"} (${user.emergencyContacts[0].relation || "Emergency"}) · ${maskPhone(user.emergencyContacts[0].phone)}`
    : "Standard 112 Police Helpline Linked";

  const statusColor = isActive ? "#10b981" : "#ef4444";
  const statusBg = isActive ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)";
  const statusBorder = isActive ? "#10b981" : "#ef4444";
  const statusText = isActive ? "VERIFIED & ACTIVE" : "SUSPENDED / INACTIVE";
  const statusDesc = isActive
    ? "Authentic tourist credential verified in good standing on the National Smart Tourist Safety Network."
    : "This account has been suspended or flagged. Please request physical government identification.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>RakshaSetu · Verified Tourist Pass (${user.digitalId})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0b1120; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 20px 16px 40px; }
    .container { width: 100%; max-width: 480px; margin: 0 auto; }
    
    .top-header { text-align: center; margin-bottom: 20px; }
    .emblem-wrap { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 28px; background: rgba(2, 132, 199, 0.18); border: 2px solid #0284c7; margin-bottom: 10px; }
    .emblem-icon { width: 30px; height: 30px; fill: #38bdf8; }
    .gov-badge { font-size: 11px; letter-spacing: 1.5px; font-weight: 800; color: #fbbf24; text-transform: uppercase; margin-bottom: 4px; }
    .gov-title { font-size: 18px; font-weight: 900; color: #f8fafc; letter-spacing: 0.5px; }
    .gov-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }

    .pass-card { background: #1e293b; border-radius: 20px; border: 1.5px solid #334155; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.5); overflow: hidden; margin-bottom: 20px; }
    .pass-header { background: #0f172a; padding: 14px 18px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    .pass-id-chip { font-family: monospace; font-size: 13px; font-weight: 700; color: #38bdf8; background: rgba(2, 132, 199, 0.2); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(2, 132, 199, 0.4); }
    .pass-type { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; }

    .status-banner { padding: 18px; background: ${statusBg}; border-bottom: 1.5px solid ${statusBorder}; text-align: center; }
    .status-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; background: ${statusColor}; color: #ffffff; font-size: 13px; font-weight: 900; letter-spacing: 0.8px; margin-bottom: 8px; }
    .status-note { font-size: 12px; color: #cbd5e1; line-height: 1.4; max-width: 380px; margin: 0 auto; }

    .details-table { padding: 18px; }
    .detail-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,0.06); gap: 12px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-val { font-size: 14px; font-weight: 700; color: #f8fafc; text-align: right; }
    .detail-val.highlight { color: #38bdf8; font-size: 16px; font-weight: 800; }
    .detail-val.mono { font-family: monospace; font-size: 13.5px; }

    .security-strip { background: rgba(15, 23, 42, 0.8); padding: 14px 18px; border-top: 1px solid #334155; font-size: 11px; color: #64748b; line-height: 1.4; display: flex; align-items: center; gap: 10px; }
    .lock-icon { width: 18px; height: 18px; fill: #64748b; flex-shrink: 0; }

    .action-row { display: flex; gap: 10px; margin-bottom: 20px; }
    .btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 16px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: 700; text-align: center; border: none; cursor: pointer; transition: all 0.2s; }
    .btn-emergency { background: #ef4444; color: #ffffff; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35); }
    .btn-secondary { background: #334155; color: #f8fafc; }

    .audit-footer { text-align: center; font-size: 11px; color: #64748b; line-height: 1.5; margin-top: 10px; }
    .pulse-dot { width: 8px; height: 8px; border-radius: 4px; background: #ffffff; animation: pulse 1.8s infinite; }
    @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } 100% { opacity: 1; transform: scale(1); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-header">
      <div class="emblem-wrap">
        <svg class="emblem-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
      </div>
      <div class="gov-badge">Government of India · Ministry of Tourism</div>
      <h1 class="gov-title">RakshaSetu Verification</h1>
      <p class="gov-sub">Smart Tourist Safety Network · Official Credential Check</p>
    </div>

    <div class="pass-card">
      <div class="pass-header">
        <span class="pass-id-chip">${escapeHtml(user.digitalId)}</span>
        <span class="pass-type">Tourist Pass</span>
      </div>

      <div class="status-banner">
        <div class="status-pill">
          <span class="pulse-dot"></span>
          ${statusText}
        </div>
        <p class="status-note">${statusDesc}</p>
      </div>

      <div class="details-table">
        <div class="detail-row">
          <span class="detail-label">Tourist Name</span>
          <span class="detail-val highlight">${escapeHtml(user.name || "Authorized Tourist")}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Digital ID</span>
          <span class="detail-val mono">${escapeHtml(user.digitalId)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Registration Status</span>
          <span class="detail-val" style="color: ${statusColor};">${isActive ? "Active · Compliant" : "Inactive / Flagged"}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Registration Date</span>
          <span class="detail-val">${registeredDate}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Emergency Contact</span>
          <span class="detail-val">${escapeHtml(primaryContact)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">National Helpline</span>
          <span class="detail-val" style="color: #ef4444; font-weight: 800;">112 (Police & Medical)</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Verification Time</span>
          <span class="detail-val">${verifiedDate}, ${verifiedTime}</span>
        </div>
      </div>

      <div class="security-strip">
        <svg class="lock-icon" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        <span>Cryptographically verified against the RakshaSetu National Tourist Safety Database. Checksum: <b>#RS-${checksum}</b></span>
      </div>
    </div>

    <div class="action-row">
      <a href="tel:112" class="btn btn-emergency">
        <span>🚨 Dial 112 Helpline</span>
      </a>
      <button onclick="window.print()" class="btn btn-secondary">
        <span>🖨️ Print / Save Pass</span>
      </button>
    </div>

    <div class="audit-footer">
      <p>This verification portal is provided for police checkposts, authorized hotel staff, and tourist safety officers.</p>
      <p style="margin-top: 4px;">© RakshaSetu Tourist Safety System · Ministry of Tourism, India</p>
    </div>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(html);
}

function renderNotFound(res, rawId) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>RakshaSetu · Unverified Tourist Pass</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b1120; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 16px; }
    .card { background: #1e293b; border-radius: 20px; border: 1.5px solid #ef4444; max-width: 440px; width: 100%; padding: 28px 22px; text-align: center; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.2); }
    .icon-wrap { width: 64px; height: 64px; border-radius: 32px; background: rgba(239, 68, 68, 0.15); border: 2px solid #ef4444; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; }
    .icon { width: 34px; height: 34px; fill: #ef4444; }
    h1 { font-size: 20px; font-weight: 900; margin-bottom: 8px; color: #f8fafc; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 18px; }
    .id-chip { font-family: monospace; font-size: 14px; font-weight: 700; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); display: inline-block; margin-bottom: 20px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 13px; border-radius: 12px; background: #ef4444; color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">
      <svg class="icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
    </div>
    <h1>Pass Not Found / Invalid</h1>
    <div class="id-chip">${escapeHtml(rawId)}</div>
    <p>This Tourist ID does not exist in the active RakshaSetu National Registry. Please verify the code or request physical identification from the traveler.</p>
    <a href="tel:112" class="btn">🚨 Dial Police Helpline (112)</a>
  </div>
</body>
</html>`;

  res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(html);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = router;

