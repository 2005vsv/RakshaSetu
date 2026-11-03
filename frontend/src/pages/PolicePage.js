import React, { useCallback, useEffect, useMemo, useState } from "react";
import { nodeApi, clearPoliceAuthToken } from "../services/api";
import { connectRealtime } from "../services/realtime";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";

// Leaflet icon fixes
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const touristIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const policeIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function PolicePage() {
  const [officers, setOfficers] = useState([]);
  const [currentOfficer, setCurrentOfficer] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [efirs, setEfirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("active"); // 'all' | 'active' | 'en_route' | 'resolved'
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal / Confirm Form State
  const [confirmModalIncident, setConfirmModalIncident] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(5);
  const [policeNote, setPoliceNote] = useState(
    "PCR Patrol Unit dispatched with emergency siren. Please remain at your current location; officers are arriving."
  );

  // Resolution Form State
  const [resolveModalIncident, setResolveModalIncident] = useState(null);
  const [resolutionText, setResolutionText] = useState(
    "Tourist located safely. First aid & security provided. No further threat detected."
  );

  // Load available police officers
  const loadOfficers = useCallback(async () => {
    try {
      const { data } = await nodeApi.get("/police/officers");
      if (Array.isArray(data) && data.length > 0) {
        setOfficers(data);
        if (!currentOfficer) {
          // Check saved preference or default to first officer (Sub-Inspector Rajesh Patil)
          const savedId = localStorage.getItem("rakshasetu_police_officer_id");
          const found = data.find((o) => String(o._id) === savedId) || data[0];
          setCurrentOfficer(found);
        }
      }
    } catch (e) {
      console.warn("Could not load officers list:", e.message);
    }
  }, [currentOfficer]);

  // Load assignments for current officer
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await nodeApi.get("/police/assignments?viewAll=true");
      setIncidents(Array.isArray(data?.incidents) ? data.incidents : []);
      setEfirs(Array.isArray(data?.efirs) ? data.efirs : []);
    } catch (e) {
      setError(e.response?.data?.error || "Could not load police assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadAssignments(), loadOfficers()]);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    loadOfficers();
  }, [loadOfficers]);

  useEffect(() => {
    loadAssignments();

    const socket = connectRealtime();

    const playAlertSound = () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
        osc.onended = () => ctx.close();
      } catch (_) {}
    };

    const handleIncidentUpdate = (payload) => {
      const inc = payload?.incident || payload;
      if (!inc || !inc._id) return;
      setIncidents((prev) => [
        inc,
        ...prev.filter((item) => String(item._id) !== String(inc._id)),
      ]);
      playAlertSound();
    };

    socket.on("incident:new", handleIncidentUpdate);
    socket.on("incident:updated", handleIncidentUpdate);
    socket.on("police:confirmed", handleIncidentUpdate);
    socket.emit("join:police", { officerId: currentOfficer?._id });

    const pollTimer = setInterval(loadAssignments, 4000);

    return () => {
      clearInterval(pollTimer);
      socket.disconnect();
    };
  }, [loadAssignments, currentOfficer]);

  // Switch active officer
  const handleSwitchOfficer = (officerId) => {
    const chosen = officers.find((o) => String(o._id) === String(officerId));
    if (chosen) {
      setCurrentOfficer(chosen);
      localStorage.setItem("rakshasetu_police_officer_id", String(chosen._id));
      setSuccessMsg(`Switched to active officer: ${chosen.name} (${chosen.policeBadge || chosen.policeStation})`);
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  };

  // Step 1: Confirm Response & Notify Tourist
  const handleConfirmResponse = async () => {
    if (!confirmModalIncident) return;
    const incId = confirmModalIncident._id;
    setBusy(incId);
    setError("");
    setSuccessMsg("");

    try {
      await nodeApi.post(`/police/assignments/${incId}/confirm`, {
        etaMinutes: Number(etaMinutes) || 5,
        note: policeNote,
      });

      setSuccessMsg(
        `🚨 CONFIRMATION DISPATCHED! Tourist ${confirmModalIncident.tourist?.name || "complainant"} has been notified that ${currentOfficer?.name || "you"} are en route!`
      );
      setConfirmModalIncident(null);
      await loadAssignments();
      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (err) {
      setError(err.response?.data?.error || "Could not confirm police response.");
    } finally {
      setBusy("");
    }
  };

  // Step 2: Mark Arrived at Scene
  const handleMarkArrived = async (incident) => {
    const incId = incident._id;
    setBusy(incId);
    setError("");
    try {
      await nodeApi.post(`/police/assignments/${incId}/arrived`, {
        note: `Officer ${currentOfficer?.name || "Patrol Unit"} has reached the tourist's coordinates.`,
      });
      setSuccessMsg(`📍 Arrived at scene recorded. Tourist has been informed.`);
      await loadAssignments();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.response?.data?.error || "Could not mark arrival.");
    } finally {
      setBusy("");
    }
  };

  // Step 3: Resolve Incident
  const handleResolveIncident = async () => {
    if (!resolveModalIncident) return;
    const incId = resolveModalIncident._id;
    setBusy(incId);
    setError("");

    try {
      await nodeApi.post(`/police/assignments/${incId}/resolve`, {
        resolution: resolutionText,
      });
      setSuccessMsg(`✅ Case #${resolveModalIncident.incidentRef} has been safely resolved & archived.`);
      setResolveModalIncident(null);
      await loadAssignments();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      setError(err.response?.data?.error || "Could not resolve incident.");
    } finally {
      setBusy("");
    }
  };

  // Filtered list
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (filter === "all") return true;
      if (filter === "active") return ["new", "assigned", "responding"].includes(inc.status);
      if (filter === "en_route") return inc.status === "responding" || inc.policeConfirmed;
      if (filter === "resolved") return inc.status === "resolved";
      return true;
    });
  }, [incidents, filter]);

  const activeCount = incidents.filter((i) => ["new", "assigned", "responding"].includes(i.status)).length;
  const enRouteCount = incidents.filter((i) => i.status === "responding" || i.policeConfirmed).length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;

  return (
    <div style={{ minHeight: "100vh", background: "#0b1329", color: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Standalone Police Operations Top Bar */}
      <header
        style={{
          background: "linear-gradient(90deg, #090e1a 0%, #0f172a 50%, #1e1b4b 100%)",
          borderBottom: "1px solid #1e293b",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#1d4ed8",
              border: "2px solid #60a5fa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              boxShadow: "0 0 15px rgba(59, 130, 246, 0.4)",
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "#f8fafc", letterSpacing: 0.5 }}>
                RakshaSetu Police Operations Console
              </span>
              <span
                style={{
                  background: "#1e3a8a",
                  color: "#93c5fd",
                  border: "1px solid #3b82f6",
                  borderRadius: 4,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "1px 6px",
                  textTransform: "uppercase",
                }}
              >
                Law Enforcement
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              Karnataka State Police · Emergency Response & Dispatch Terminal
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "6px 12px",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: isOnDuty ? "#22c55e" : "#ef4444",
                boxShadow: isOnDuty ? "0 0 8px #22c55e" : "none",
              }}
            />
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#e2e8f0" }}>
              {currentOfficer?.name || "Officer"}
            </span>
            <span style={{ fontSize: "0.78rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "1px 6px", borderRadius: 4 }}>
              {currentOfficer?.policeBadge || "PCR"}
            </span>
          </div>

          <button
            type="button"
            className="ops-button subtle"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              color: "#f87171",
              border: "1px solid #ef4444",
              borderRadius: 8,
              padding: "7px 14px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
            onClick={async () => {
              try {
                await nodeApi.post("/auth/logout");
              } catch (_) {}
              clearPoliceAuthToken();
              window.location.href = "/police/login";
            }}
          >
            🚪 Logout
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 24px" }}>
        <main className="ops-page police-portal-page" style={{ padding: 0 }}>
        {/* Top Police Control Header */}
        <header
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: "20px 24px",
            color: "#ffffff",
            marginBottom: 20,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#1e3a8a",
                  border: "2px solid #3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}
              >
                🚔
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: "0.72rem",
                      fontWeight: "bold",
                      padding: "2px 8px",
                      borderRadius: 4,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    POLICE DISPATCH & FIELD RESPONSE
                  </span>
                  <span
                    style={{
                      background: isOnDuty ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: isOnDuty ? "#4ade80" : "#f87171",
                      border: `1px solid ${isOnDuty ? "#22c55e" : "#ef4444"}`,
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      padding: "2px 8px",
                      borderRadius: 12,
                    }}
                  >
                    ● {isOnDuty ? "ON DUTY (READY)" : "OFF DUTY"}
                  </span>
                </div>
                <h1 style={{ margin: "4px 0 2px", fontSize: "1.65rem", fontWeight: 700, color: "#fff" }}>
                  {currentOfficer?.name || "Registered Police Officer"}
                </h1>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>
                  Badge: <b style={{ color: "#38bdf8" }}>{currentOfficer?.policeBadge || "PCR"}</b> ·{" "}
                  Station: <b>{currentOfficer?.policeStation || "Karnataka State Police"}</b> · Contact:{" "}
                  {currentOfficer?.phone || "112"}
                </p>
              </div>
            </div>

            {/* Officer Switcher for Registered Officers */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: "bold" }}>
                  Active Police Officer:
                </label>
                <select
                  aria-label="Active Police Officer"
                  value={currentOfficer?._id || ""}
                  onChange={(e) => handleSwitchOfficer(e.target.value)}
                  style={{
                    background: "#0f172a",
                    color: "#f8fafc",
                    border: "1px solid #3b82f6",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  {officers.map((off) => (
                    <option key={off._id} value={off._id}>
                      👮 {off.name} ({off.policeBadge || "PCR"}) · {off.policeStation || "Belagavi"}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsOnDuty(!isOnDuty)}
                style={{
                  alignSelf: "flex-end",
                  height: 38,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: `1px solid ${isOnDuty ? "#f87171" : "#4ade80"}`,
                  background: isOnDuty ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                  color: isOnDuty ? "#fca5a5" : "#86efac",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {isOnDuty ? "Go Off Duty" : "Resume Duty"}
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  alignSelf: "flex-end",
                  height: 38,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #3b82f6",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {refreshing ? "↻ Refreshing…" : "↻ Refresh Queue"}
              </button>
            </div>
          </div>
        </header>

        {/* Notifications Banner */}
        {error ? <div className="ops-banner error" style={{ marginBottom: 16 }}>{error}</div> : null}
        {successMsg ? (
          <div
            className="ops-banner success"
            style={{
              marginBottom: 16,
              background: "#064e3b",
              border: "1px solid #10b981",
              color: "#a7f3d0",
              fontWeight: "600",
              fontSize: "0.95rem",
              padding: "12px 16px",
              borderRadius: 8,
            }}
          >
            {successMsg}
          </div>
        ) : null}

        {/* Metric Cards */}
        <section className="ops-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 20 }}>
          <article style={{ background: "#1e293b", border: "1px solid #334155", borderLeft: "4px solid #ef4444" }}>
            <span style={{ color: "#94a3b8" }}>Active SOS / E-FIRs</span>
            <b style={{ color: "#ef4444" }}>{activeCount}</b>
          </article>
          <article style={{ background: "#1e293b", border: "1px solid #334155", borderLeft: "4px solid #3b82f6" }}>
            <span style={{ color: "#94a3b8" }}>En Route (Confirmed)</span>
            <b style={{ color: "#38bdf8" }}>{enRouteCount}</b>
          </article>
          <article style={{ background: "#1e293b", border: "1px solid #334155", borderLeft: "4px solid #10b981" }}>
            <span style={{ color: "#94a3b8" }}>Resolved Cases</span>
            <b style={{ color: "#4ade80" }}>{resolvedCount}</b>
          </article>
          <article style={{ background: "#1e293b", border: "1px solid #334155", borderLeft: "4px solid #f59e0b" }}>
            <span style={{ color: "#94a3b8" }}>E-FIR Cases</span>
            <b style={{ color: "#fbbf24" }}>{efirs.length}</b>
          </article>
          <article style={{ background: "#1e293b", border: "1px solid #334155", borderLeft: "4px solid #a855f7" }}>
            <span style={{ color: "#94a3b8" }}>Registered Officers</span>
            <b style={{ color: "#c084fc" }}>{officers.length}</b>
          </article>
        </section>

        {/* Filters Bar with High-Contrast Dark-Theme Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            padding: "12px 18px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { id: "active", label: `🚨 Active Emergencies (${activeCount})` },
              { id: "en_route", label: `🚔 En Route (${enRouteCount})` },
              { id: "resolved", label: `✅ Resolved (${resolvedCount})` },
              { id: "all", label: `All Records (${incidents.length})` },
            ].map((tab) => {
              const isSelected = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    padding: "8px 16px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: isSelected ? "2px solid #60a5fa" : "1px solid #475569",
                    background: isSelected ? "#2563eb" : "#0f172a",
                    color: isSelected ? "#ffffff" : "#f1f5f9",
                    boxShadow: isSelected ? "0 0 14px rgba(59, 130, 246, 0.45)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>
            ● Live Realtime Dispatch · Auto-refreshing
          </div>
        </div>

        {/* Incident Cards Queue */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {loading && !incidents.length ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              Loading assigned emergencies...
            </div>
          ) : !filteredIncidents.length ? (
            <div
              style={{
                padding: 48,
                textAlign: "center",
                background: "var(--card-bg, #ffffff)",
                border: "1px dashed var(--border, #cbd5e1)",
                borderRadius: 12,
              }}
            >
              <span style={{ fontSize: 42 }}>🛡️</span>
              <h3 style={{ marginTop: 10, marginBottom: 4 }}>No Emergencies In This Queue</h3>
              <p style={{ color: "#64748b", margin: 0 }}>
                When tourists trigger SOS or Admin assigns an e-FIR, it will appear here in real time.
              </p>
            </div>
          ) : (
            filteredIncidents.map((incident) => {
              const hasCoords = incident.location?.latitude != null && incident.location?.longitude != null;
              const lat = Number(incident.location?.latitude || 15.8152112);
              const lng = Number(incident.location?.longitude || 74.4874746);
              const isAssigned = Array.isArray(incident.assignedPolice) && incident.assignedPolice.length > 0;
              const isEnRoute = incident.status === "responding" || incident.policeConfirmed;
              const isResolved = incident.status === "resolved";

              const myAssignment = (incident.assignedPolice || []).find(
                (p) => String(p.officer) === String(currentOfficer?._id)
              );

              return (
                <article
                  key={incident._id}
                  style={{
                    background: "var(--card-bg, #ffffff)",
                    border: isEnRoute ? "2px solid #3b82f6" : isResolved ? "1px solid #10b981" : "2px solid #ef4444",
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: isEnRoute
                      ? "0 4px 20px -2px rgba(59, 130, 246, 0.15)"
                      : "0 4px 15px -2px rgba(0, 0, 0, 0.06)",
                    position: "relative",
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 10,
                      borderBottom: "1px solid var(--border, #f1f5f9)",
                      paddingBottom: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            background: isResolved ? "#10b981" : isEnRoute ? "#3b82f6" : "#ef4444",
                            color: "#fff",
                            fontWeight: "bold",
                            fontSize: "0.75rem",
                            padding: "3px 8px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          {isResolved ? "RESOLVED" : isEnRoute ? "POLICE EN ROUTE" : "🚨 SOS DISTRESS BEACON"}
                        </span>
                        {myAssignment && (
                          <span
                            style={{
                              background: "#1e3a8a",
                              color: "#fff",
                              fontWeight: "bold",
                              fontSize: "0.75rem",
                              padding: "3px 8px",
                              borderRadius: 4,
                            }}
                          >
                            👮 ASSIGNED TO YOU
                          </span>
                        )}
                        <b style={{ fontSize: "1rem", color: "#0f172a" }}>
                          Case #{incident.incidentRef || incident._id}
                        </b>
                      </div>
                      <small style={{ color: "#64748b" }}>
                        Reported on {new Date(incident.createdAt).toLocaleString()} · Severity:{" "}
                        <b style={{ color: "#dc2626" }}>{incident.severity?.toUpperCase()}</b>
                      </small>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          background: isEnRoute ? "#dbeafe" : isResolved ? "#dcfce7" : "#fee2e2",
                          color: isEnRoute ? "#1e40af" : isResolved ? "#166534" : "#991b1b",
                          padding: "4px 12px",
                          borderRadius: 20,
                          fontWeight: "700",
                          fontSize: "0.85rem",
                        }}
                      >
                        Status: {incident.status?.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Body Grid: Details & Map */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                      gap: 20,
                    }}
                  >
                    {/* Left: Tourist & Incident Details */}
                    <div>
                      <div style={{ background: "var(--soft, #f8fafc)", padding: "12px 16px", borderRadius: 8, marginBottom: 12 }}>
                        <p style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "#64748b", fontWeight: "bold" }}>
                          COMPLAINANT / TOURIST DETAILS:
                        </p>
                        <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem", color: "#0f172a" }}>
                          {incident.tourist?.name || "Emergency Tourist"}
                        </h3>
                        <p style={{ margin: "0 0 4px", fontSize: "0.9rem", color: "#334155" }}>
                          Digital ID: <b>{incident.tourist?.digitalId || "Pending Verification"}</b>
                        </p>
                        <p style={{ margin: 0, fontSize: "0.95rem" }}>
                          Phone:{" "}
                          <a
                            href={`tel:${incident.tourist?.phone}`}
                            style={{
                              color: "#2563eb",
                              fontWeight: "bold",
                              textDecoration: "underline",
                            }}
                          >
                            📞 {incident.tourist?.phone || "No phone supplied"}
                          </a>
                        </p>
                      </div>

                      {/* Distress Message */}
                      <div
                        style={{
                          background: "#fff1f2",
                          border: "1px solid #fecdd3",
                          padding: "12px 14px",
                          borderRadius: 8,
                          marginBottom: 12,
                        }}
                      >
                        <b style={{ color: "#9f1239", fontSize: "0.85rem" }}>EMERGENCY MESSAGE:</b>
                        <p style={{ margin: "4px 0 0", color: "#881337", fontSize: "0.95rem", fontWeight: "500" }}>
                          "{incident.message}"
                        </p>
                      </div>

                      {/* Coordinates & Google Maps */}
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "#64748b", fontWeight: "bold" }}>
                          GPS LOCATION:
                        </p>
                        {hasCoords ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", color: "#0f172a", background: "#f1f5f9", padding: "4px 8px", borderRadius: 4 }}>
                              📍 {lat.toFixed(6)}, {lng.toFixed(6)}
                            </span>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#2563eb",
                                fontSize: "0.88rem",
                                fontWeight: "bold",
                                textDecoration: "underline",
                              }}
                            >
                              Open in Google Maps Directions ↗
                            </a>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>Location coordinates unavailable</span>
                        )}
                      </div>

                      {/* Assigned Police Officers */}
                      {isAssigned && (
                        <div
                          style={{
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: 8,
                            padding: "10px 14px",
                            marginBottom: 12,
                          }}
                        >
                          <b style={{ color: "#1e40af", fontSize: "0.85rem" }}>ASSIGNED POLICE OFFICERS:</b>
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            {incident.assignedPolice.map((p, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  fontSize: "0.88rem",
                                }}
                              >
                                <span>
                                  👮 <b>{p.name}</b> ({p.station || p.badge})
                                </span>
                                <span
                                  style={{
                                    background:
                                      p.status === "en_route"
                                        ? "#3b82f6"
                                        : p.status === "arrived"
                                        ? "#8b5cf6"
                                        : p.status === "resolved"
                                        ? "#10b981"
                                        : "#f59e0b",
                                    color: "#fff",
                                    fontSize: "0.75rem",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {p.status?.toUpperCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Police Confirmation Info Banner if confirmed */}
                      {incident.policeConfirmed && (
                        <div
                          style={{
                            background: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            borderRadius: 8,
                            padding: "10px 14px",
                            marginBottom: 12,
                          }}
                        >
                          <b style={{ color: "#065f46", fontSize: "0.85rem" }}>
                            🚨 POLICE CONFIRMATION ACTIVE (TRANSMITTED TO TOURIST):
                          </b>
                          <p style={{ margin: "4px 0 0", color: "#047857", fontSize: "0.9rem" }}>
                            "{incident.policeConfirmationMessage || "Police officer is en route."}"
                          </p>
                          {incident.policeConfirmedAt && (
                            <small style={{ color: "#059669" }}>
                              Confirmed at {new Date(incident.policeConfirmedAt).toLocaleTimeString()}
                            </small>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Interactive Mini Leaflet Map */}
                    <div>
                      {hasCoords && (
                        <div
                          style={{
                            height: 220,
                            borderRadius: 8,
                            overflow: "hidden",
                            border: "1px solid #cbd5e1",
                            position: "relative",
                          }}
                        >
                          <MapContainer
                            center={[lat, lng]}
                            zoom={15}
                            style={{ height: "100%", width: "100%" }}
                            scrollWheelZoom={false}
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <Marker position={[lat, lng]} icon={touristIcon}>
                              <Popup>
                                <b>{incident.tourist?.name || "Tourist"}</b>
                                <br />
                                {incident.message}
                              </Popup>
                            </Marker>
                            <Marker position={[15.814980, 74.491220]} icon={policeIcon}>
                              <Popup>
                                <b>🚔 {currentOfficer?.policeStation || "Police Station"}</b>
                                <br />
                                Response Unit
                              </Popup>
                            </Marker>
                            <Circle center={[lat, lng]} radius={150} color="#ef4444" fillOpacity={0.2} />
                          </MapContainer>
                        </div>
                      )}

                      {/* Action Buttons for Responding Police */}
                      <div
                        style={{
                          marginTop: 14,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {!isResolved && (
                          <>
                            {/* ACTION 1: CONFIRM RESPONSE ("I WILL COME") */}
                            <button
                              type="button"
                              className="ops-button"
                              disabled={busy === incident._id}
                              onClick={() => {
                                setConfirmModalIncident(incident);
                                setEtaMinutes(5);
                                setPoliceNote(
                                  `Officer ${currentOfficer?.name || "Patrol Unit"} (${currentOfficer?.policeStation || "Belagavi Police"}) confirmed response. We are en route with emergency beacon. Stay safe.`
                                );
                              }}
                              style={{
                                background: isEnRoute ? "#1e40af" : "#dc2626",
                                color: "#fff",
                                fontWeight: "bold",
                                fontSize: "1rem",
                                padding: "12px 18px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)",
                              }}
                            >
                              <span>🚨</span>
                              {isEnRoute ? "Update En Route ETA & Message" : "CONFIRM RESPONSE / I AM COMING"}
                            </button>

                            {/* ACTION 2: MARK ARRIVED AT SCENE */}
                            {isEnRoute && (
                              <button
                                type="button"
                                className="ops-button"
                                disabled={busy === incident._id}
                                onClick={() => handleMarkArrived(incident)}
                                style={{
                                  background: "#7c3aed",
                                  color: "#fff",
                                  fontWeight: "bold",
                                  padding: "10px 16px",
                                }}
                              >
                                📍 ARRIVED AT SCENE (NEAR TOURIST)
                              </button>
                            )}

                            {/* ACTION 3: RESOLVE INCIDENT */}
                            <button
                              type="button"
                              className="ops-button subtle"
                              disabled={busy === incident._id}
                              onClick={() => {
                                setResolveModalIncident(incident);
                                setResolutionText(
                                  `Tourist ${incident.tourist?.name || "complainant"} secured safely by Officer ${currentOfficer?.name || "Police"}. Threat addressed.`
                                );
                              }}
                              style={{
                                border: "1px solid #10b981",
                                color: "#059669",
                                fontWeight: "bold",
                              }}
                            >
                              ✅ Case Resolved & Secured
                            </button>
                          </>
                        )}

                        {isResolved && (
                          <div
                            style={{
                              background: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              color: "#166534",
                              padding: "10px 14px",
                              borderRadius: 6,
                              fontSize: "0.88rem",
                            }}
                          >
                            <b>✅ Incident Closed:</b> {incident.resolution || "Resolved by responding officer."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* CONFIRMATION RESPONSE MODAL */}
        {confirmModalIncident && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              style={{
                background: "#1e293b",
                borderRadius: 14,
                border: "2px solid #3b82f6",
                maxWidth: 540,
                width: "100%",
                padding: 24,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(59, 130, 246, 0.25)",
                color: "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#f8fafc", fontWeight: 700 }}>
                  🚨 Confirm Police Response
                </h2>
                <button
                  type="button"
                  onClick={() => setConfirmModalIncident(null)}
                  style={{
                    background: "#334155",
                    color: "#f8fafc",
                    border: "1px solid #475569",
                    borderRadius: 6,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: "#cbd5e1", fontSize: "0.95rem", margin: "0 0 16px", lineHeight: 1.5 }}>
                Confirming here will <b style={{ color: "#38bdf8" }}>immediately alert the tourist on their phone</b> that you are coming,
                provide your officer contact number, and show your estimated arrival time.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.9rem", marginBottom: 8, color: "#f8fafc" }}>
                  Estimated Arrival Time (ETA Minutes):
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[3, 5, 8, 10, 15].map((mins) => {
                    const isSelected = etaMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setEtaMinutes(mins)}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: "0.92rem",
                          cursor: "pointer",
                          border: isSelected ? "2px solid #60a5fa" : "1px solid #475569",
                          background: isSelected ? "#2563eb" : "#0f172a",
                          color: "#ffffff",
                          boxShadow: isSelected ? "0 0 15px rgba(59, 130, 246, 0.5)" : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {mins} mins
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.9rem", marginBottom: 8, color: "#f8fafc" }}>
                  Message to Complainant / Tourist:
                </label>
                <textarea
                  rows={3}
                  value={policeNote}
                  onChange={(e) => setPoliceNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 6,
                    border: "1px solid #475569",
                    background: "#0f172a",
                    color: "#f8fafc",
                    fontSize: "0.92rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setConfirmModalIncident(null)}
                  style={{
                    background: "#334155",
                    color: "#f8fafc",
                    border: "1px solid #475569",
                    borderRadius: 6,
                    padding: "9px 18px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy === confirmModalIncident._id}
                  onClick={handleConfirmResponse}
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 800,
                    padding: "9px 20px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    boxShadow: "0 0 15px rgba(220, 38, 38, 0.4)",
                  }}
                >
                  {busy ? "Transmitting..." : "🚨 Transmit Confirmation to Tourist"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RESOLVE CASE MODAL */}
        {resolveModalIncident && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              style={{
                background: "#1e293b",
                borderRadius: 14,
                border: "2px solid #10b981",
                maxWidth: 540,
                width: "100%",
                padding: 24,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.25)",
                color: "#ffffff",
              }}
            >
              <h2 style={{ margin: "0 0 12px", fontSize: "1.3rem", color: "#f8fafc", fontWeight: 700 }}>
                ✅ Complete & Resolve Incident
              </h2>
              <p style={{ color: "#cbd5e1", fontSize: "0.95rem", margin: "0 0 16px", lineHeight: 1.5 }}>
                Record your final field report. This marks the case as secured in both Police and Admin registers.
              </p>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.9rem", marginBottom: 8, color: "#f8fafc" }}>
                  Resolution / Field Report:
                </label>
                <textarea
                  rows={4}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 6,
                    border: "1px solid #475569",
                    background: "#0f172a",
                    color: "#f8fafc",
                    fontSize: "0.92rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setResolveModalIncident(null)}
                  style={{
                    background: "#334155",
                    color: "#f8fafc",
                    border: "1px solid #475569",
                    borderRadius: 6,
                    padding: "9px 18px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy === resolveModalIncident._id}
                  onClick={handleResolveIncident}
                  style={{
                    background: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 800,
                    padding: "9px 20px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)",
                  }}
                >
                  {busy ? "Saving..." : "Close Case as Resolved"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  </div>
  );
}
