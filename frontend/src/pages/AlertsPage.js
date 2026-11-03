import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import MapView from "../components/MapView";
import { nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";

const severityOf = (alert) =>
  ["high", "high_priority", "sos", "offline", "panic", "emergency", "critical"].includes(
    String(alert.severity || alert.type || "").toLowerCase()
  )
    ? "high"
    : ["medium", "warning", "geofence"].includes(
        String(alert.severity || alert.type || "").toLowerCase()
      )
    ? "medium"
    : "low";
    
const locationOf = (alert) => {
  if (!alert) return null;
  // 1. Direct coordinates
  if (alert.latitude != null && alert.longitude != null) {
    const lat = Number(alert.latitude);
    const lng = Number(alert.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { latitude: lat, longitude: lng };
    }
  }
  // 2. Location object (parity with Incident)
  if (alert.location?.latitude != null && alert.location?.longitude != null) {
    const lat = Number(alert.location.latitude);
    const lng = Number(alert.location.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { latitude: lat, longitude: lng };
    }
  }
  // 3. GeoJSON coordinates array: [lng, lat]
  if (Array.isArray(alert.geoLocation?.coordinates) && alert.geoLocation.coordinates.length >= 2) {
    const lng = Number(alert.geoLocation.coordinates[0]);
    const lat = Number(alert.geoLocation.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { latitude: lat, longitude: lng };
    }
  }
  // 4. Object coordinates { lat, lng }
  if (alert.geoLocation?.lat != null && alert.geoLocation?.lng != null) {
    const lat = Number(alert.geoLocation.lat);
    const lng = Number(alert.geoLocation.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [policeOfficers, setPoliceOfficers] = useState([]);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState({ type: "manual", severity: "medium", message: "", latitude: "", longitude: "" });
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsInput, setSmsInput] = useState("");
  const [smsSender, setSmsSender] = useState("+919876543210");
  const [smsSubmitting, setSmsSubmitting] = useState(false);

  const handleIngestSms = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!smsInput.trim()) return;
    setSmsSubmitting(true);
    try {
      await nodeApi.post("/incidents/sms-inbound", {
        Body: smsInput.trim(),
        From: smsSender.trim() || "+919876543210",
      });
      setShowSmsModal(false);
      setSmsInput("");
      await handleRefresh();
      window.alert("✅ Inbound Cellular SMS Beacon received and registered in Alert Centre!");
    } catch (err) {
      window.alert("Failed to ingest SMS: " + (err.response?.data?.error || err.message));
    } finally {
      setSmsSubmitting(false);
    }
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const [alertsRes, policeRes] = await Promise.all([
        nodeApi.get(`/alerts?_t=${Date.now()}`),
        nodeApi.get(`/police/officers?_t=${Date.now()}`).catch(() => ({ data: [] })),
      ]);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : alertsRes.data.alerts || []);
      setPoliceOfficers(Array.isArray(policeRes.data) ? policeRes.data : []);
    } catch (e) {
      setError(e.response?.data?.error || "Could not load alerts. Check that you are signed in and the Node API is running.");
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const assignPoliceToAlert = async (alertId, officerId) => {
    if (!officerId) return;
    const officer = policeOfficers.find((p) => String(p._id) === String(officerId));
    if (!officer) return;
    try {
      await nodeApi.put(`/alerts/${alertId}/assign`, {
        station_id: officer._id,
        station_name: `${officer.name} (${officer.policeStation?.split(",")[0] || officer.policeBadge})`,
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not assign officer to alert.");
    }
  };

  useEffect(() => {
    load();
    const socket = connectRealtime();
    const refresh = () => load();
    socket.on("alert:new", refresh);
    socket.on("alert:updated", refresh);
    socket.on("incident:new", refresh);
    socket.on("incident:updated", refresh);
    socket.on("geofence:deactivated", refresh);
    socket.on("geofence:deleted", refresh);
    socket.on("zone:deleted", refresh);
    return () => socket.disconnect();
  }, [load]);

  const rows = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          (severity === "all" || severityOf(alert) === severity) &&
          `${alert.type || ""} ${alert.severity || ""} ${alert.message || ""}`.toLowerCase().includes(query.toLowerCase())
      ),
    [alerts, severity, query]
  );

  // Active markers on the map: only show active/unresolved alerts that have valid coordinates
  const activeMarkers = useMemo(() => {
    return rows
      .filter((item) => !item.is_resolved && locationOf(item))
      .map((item) => {
        const loc = locationOf(item);
        return {
          ...item,
          latitude: loc.latitude,
          longitude: loc.longitude,
          severity: severityOf(item),
        };
      });
  }, [rows]);

  const create = async (event) => {
    event.preventDefault();
    setBusy("create");
    setError("");
    try {
      const lat = Number(draft.latitude);
      const lng = Number(draft.longitude);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const payload = {
        type: draft.type,
        severity: draft.severity,
        message: draft.message,
        geoLocation: hasCoords ? { type: "Point", coordinates: [lng, lat] } : undefined,
        location: hasCoords ? { latitude: lat, longitude: lng, recordedAt: new Date() } : undefined,
        latitude: hasCoords ? lat : undefined,
        longitude: hasCoords ? lng : undefined,
      };
      await nodeApi.post("/alerts", payload);
      setDraft({ ...draft, message: "", latitude: "", longitude: "" });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Alert creation failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <AdminLayout>
      <main className="ops-page">
        <header className="ops-heading">
          <div>
            <p className="ops-kicker">INCIDENT OPERATIONS</p>
            <h1>Alert centre</h1>
            <p>Review real-time tourist emergency SOS signals, safety events, and live GPS coordinates.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="ops-button"
              style={{ background: "#7c3aed", color: "#fff", borderColor: "#6d28d9", fontWeight: 700 }}
              onClick={() => setShowSmsModal(true)}
            >
              📥 Ingest Offline SMS Beacon
            </button>
            <button className="ops-button" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "↻ Refreshing…" : "↻ Refresh Feed"}
            </button>
          </div>
        </header>

        {error && <div className="ops-banner error">{error}</div>}

        <section className="ops-stats">
          <article>
            <span>Visible alerts</span>
            <b>{rows.length}</b>
          </article>
          <article>
            <span>High priority</span>
            <b>{alerts.filter((item) => severityOf(item) === "high" && !item.is_resolved).length}</b>
          </article>
          <article>
            <span>Active / Unresolved</span>
            <b>{alerts.filter((item) => !item.is_resolved).length}</b>
          </article>
        </section>

        <section className="ops-card">
          <div className="ops-card-head">
            <div>
              <h2>Alert map</h2>
              <p>Active emergency alerts and registered safety boundaries. Click any marker for details.</p>
            </div>
          </div>
          <MapView markers={activeMarkers} />
        </section>

        <section className="ops-card">
          <div className="ops-card-head">
            <div>
              <h2>Alert feed</h2>
              <p>Real-time distress broadcasts and incident logs.</p>
            </div>
            <div className="ops-filters">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search alerts" />
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="all">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Alert</th>
                  <th>Priority</th>
                  <th>Reported</th>
                  <th>Location (GPS)</th>
                  <th>Assignment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const loc = locationOf(item);
                  return (
                    <tr key={item._id || item.id}>
                      <td>
                        <b>{item.type ? item.type.toUpperCase() : "SAFETY ALERT"}</b>
                        <small>{item.message}</small>
                      </td>
                      <td>
                        <span className={`ops-pill ${severityOf(item)}`}>{severityOf(item)}</span>
                      </td>
                      <td>{new Date(item.createdAt || item.timestamp).toLocaleString()}</td>
                      <td>
                        {loc ? (
                          <div style={{ lineHeight: "1.4" }}>
                            <span style={{ fontWeight: 600, color: "#0f766e" }}>
                              📍 {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                            </span>
                            <br />
                            <a
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-block",
                                marginTop: "3px",
                                fontSize: "0.82rem",
                                color: "#2563eb",
                                textDecoration: "underline",
                              }}
                              href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=16/${loc.latitude}/${loc.longitude}`}
                            >
                              View on OpenStreetMap ↗
                            </a>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>Unavailable</span>
                        )}
                      </td>
                      <td>
                        {item.assigned_station_name ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span
                              style={{
                                display: "inline-block",
                                background: "#dcfce7",
                                color: "#166534",
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontWeight: 700,
                                fontSize: "0.82rem",
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              👮 {item.assigned_station_name}
                            </span>
                            <select
                              aria-label="Reassign police officer"
                              value=""
                              onChange={(e) => assignPoliceToAlert(item._id || item.id, e.target.value)}
                              style={{
                                fontSize: "0.76rem",
                                color: "#475569",
                                background: "#f8fafc",
                                border: "1px dashed #cbd5e1",
                                borderRadius: 4,
                                padding: "2px 4px",
                                cursor: "pointer",
                                maxWidth: 210,
                              }}
                            >
                              <option value="">Reassign officer…</option>
                              {policeOfficers.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name} ({p.policeStation?.split(",")[0] || p.policeBadge})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <select
                            aria-label="Assign police officer"
                            value=""
                            onChange={(e) => assignPoliceToAlert(item._id || item.id, e.target.value)}
                            style={{
                              padding: "6px 10px",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              borderRadius: 6,
                              border: "1px solid #3b82f6",
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              cursor: "pointer",
                              maxWidth: 220,
                            }}
                          >
                            <option value="">👮 Assign Police Officer…</option>
                            {policeOfficers.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} ({p.policeStation?.split(",")[0] || p.policeBadge})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan="5" className="ops-empty">
                      {error ? "Feed unavailable" : "No alerts match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ops-card">
          <div className="ops-card-head">
            <div>
              <h2>Record a reported alert</h2>
              <p>Use this for a verified report received by an operator. Tourist SOS uses the mobile panic workflow.</p>
            </div>
          </div>
          <form className="ops-form" onSubmit={create}>
            <label>
              Incident type
              <input required value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} />
            </label>
            <label>
              Priority
              <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="wide">
              Details
              <input required value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
            </label>
            <label>
              Latitude
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                value={draft.latitude}
                onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                value={draft.longitude}
                onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
              />
            </label>
            <button className="ops-button" disabled={busy === "create"}>
              {busy === "create" ? "Saving…" : "Record alert"}
            </button>
          </form>
        </section>
      </main>

      {/* 📥 INGEST OFFLINE SMS BEACON MODAL */}
      {showSmsModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              maxWidth: 580,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "#0f172a",
                color: "#ffffff",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>📴</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Inbound Cellular SMS Gateway</h3>
                  <small style={{ color: "#94a3b8" }}>Ingest distress SMS from tourists with zero mobile data/Wi-Fi</small>
                </div>
              </div>
              <button
                onClick={() => setShowSmsModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIngestSms} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                  Incoming Sender Mobile Number:
                </label>
                <input
                  type="text"
                  value={smsSender}
                  onChange={(e) => setSmsSender(e.target.value)}
                  placeholder="+919876543210"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>
                    Distress SMS Message Content:
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSmsInput(
                        "EMERGENCY: Tourist Vaishnav (#DIG-TOURIST) in distress at Lat: 15.8152, Lng: 74.4875. Map: https://maps.google.com/?q=15.8152,74.4875"
                      )
                    }
                    style={{
                      background: "rgba(124, 58, 237, 0.1)",
                      border: "1px solid #c4b5fd",
                      color: "#6d28d9",
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ⚡ Auto-Fill Sample SMS
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={smsInput}
                  onChange={(e) => setSmsInput(e.target.value)}
                  placeholder="Paste or type SMS body received on 112 helpline (e.g. EMERGENCY: Tourist Vaishnav (#DIG-TOURIST) in distress at Lat: 15.8152, Lng: 74.4875)"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                    fontFamily: "monospace",
                    lineHeight: 1.4,
                  }}
                  required
                />
              </div>

              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 6, marginBottom: 16, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b", display: "block", lineHeight: 1.4 }}>
                  ℹ️ When a tourist is offline with mobile data and Wi-Fi off, their phone transmits this distress format over GSM to 112. The system auto-extracts the Digital ID, tourist name, and GPS coordinates and creates active incident and alert pins across the control room.
                </small>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowSmsModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={smsSubmitting}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 6,
                    border: "none",
                    background: "#7c3aed",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {smsSubmitting ? "Ingesting..." : "🚀 Ingest to Control Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
