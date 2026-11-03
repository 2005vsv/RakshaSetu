import React, { useCallback, useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";

const actions = {
  new: [
    ["acknowledged", "Acknowledge"],
    ["cancelled", "False report"],
  ],
  acknowledged: [
    ["assigned", "Assign to me"],
    ["responding", "Start response"],
    ["resolved", "Resolve"],
  ],
  assigned: [
    ["responding", "Start response"],
    ["resolved", "Resolve"],
  ],
  responding: [["resolved", "Resolve"]],
  resolved: [["new", "Reopen"]],
  cancelled: [["new", "Reopen"]],
};

export default function SOSPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState({});
  const [responders, setResponders] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [policeOfficers, setPoliceOfficers] = useState([]);
  const [selectedOfficers, setSelectedOfficers] = useState({}); // { [incidentId]: [officerId1, ...] }
  const [policeNotes, setPoliceNotes] = useState({});
  const [refreshing, setRefreshing] = useState(false);
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
      window.alert("✅ Inbound Cellular SMS Beacon received and registered in Control Room!");
    } catch (err) {
      window.alert("Failed to ingest SMS: " + (err.response?.data?.error || err.message));
    } finally {
      setSmsSubmitting(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const { data } = await nodeApi.get(`/incidents?_t=${Date.now()}`);
      setIncidents(data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Incident records could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      const { data } = await nodeApi.get(`/police/officers?_t=${Date.now()}`);
      setPoliceOfficers(Array.isArray(data) ? data : []);
    } catch (_) {} finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    load();
    let soundEnabled = false;
    nodeApi
      .get("/admin/settings")
      .then(({ data }) => {
        soundEnabled = Boolean(data.alertSoundEnabled);
      })
      .catch(() => {});

    nodeApi
      .get("/admin/responders")
      .then(({ data }) => setResponders(data || []))
      .catch(() => {});

    nodeApi
      .get("/police/officers")
      .then(({ data }) => setPoliceOfficers(Array.isArray(data) ? data : []))
      .catch(() => {});

    const socket = connectRealtime();
    const apply = (payload) => {
      const incident = payload?.incident || payload;
      if (!incident || !incident._id) return;
      setIncidents((rows) =>
        [incident, ...rows.filter((row) => row._id !== incident._id)].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      );
    };

    socket.on("incident:new", (payload) => {
      apply(payload);
      if (soundEnabled) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const context = new AudioContextClass();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 740;
          gain.gain.value = 0.08;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.25);
          oscillator.onended = () => context.close();
        } catch (_) {}
      }
    });

    socket.on("incident:updated", apply);
    socket.on("police:confirmed", apply);
    socket.on("connect", load);

    // Auto-poll every 3 seconds to guarantee instant visibility
    const pollTimer = setInterval(load, 3000);

    return () => {
      clearInterval(pollTimer);
      socket.disconnect();
    };
  }, [load]);

  const update = async (incident, status) => {
    setBusy(incident._id);
    setError("");
    try {
      const { data } = await nodeApi.patch(`/incidents/${incident._id}/status`, {
        status,
        note: notes[incident._id] || "",
        ...(status === "assigned" ? { responderId: assignments[incident._id] } : {}),
      });
      setIncidents((rows) => [data, ...rows.filter((row) => row._id !== data._id)]);
      setNotes((current) => ({ ...current, [incident._id]: "" }));
    } catch (err) {
      setError(err.response?.data?.error || "Incident could not be updated.");
    } finally {
      setBusy("");
      nodeApi
        .get("/admin/responders")
        .then(({ data }) => setResponders(data || []))
        .catch(() => {});
    }
  };

  const toggleOfficerSelect = (incidentId, officerId) => {
    setSelectedOfficers((prev) => {
      const current = prev[incidentId] || [];
      if (current.includes(officerId)) {
        return { ...prev, [incidentId]: current.filter((id) => id !== officerId) };
      } else {
        return { ...prev, [incidentId]: [...current, officerId] };
      }
    });
  };

  const handleAssignPolice = async (incident) => {
    const offIds = selectedOfficers[incident._id] || [];
    if (!offIds.length) {
      window.alert("Please check at least one police officer below to assign.");
      return;
    }
    setBusy(incident._id);
    setError("");
    try {
      const { data } = await nodeApi.post(`/incidents/${incident._id}/assign-police`, {
        officerIds: offIds,
        note: policeNotes[incident._id] || "Emergency dispatch assigned by central admin.",
      });
      const updated = data.incident || data;
      setIncidents((rows) => [updated, ...rows.filter((r) => r._id !== updated._id)]);
      setSelectedOfficers((prev) => ({ ...prev, [incident._id]: [] }));
      window.alert(
        `✅ Successfully assigned ${offIds.length} police officer(s) to Case #${incident.incidentRef}. Police panel has been alerted.`
      );
    } catch (err) {
      setError(err.response?.data?.error || "Could not assign police officers.");
    } finally {
      setBusy("");
    }
  };

  const dispatchToPolice = async (incident) => {
    const dispatchNote = window.prompt(
      "Dispatch to Police Helpline (112) / Station:\nEnter police station name or patrol unit details:",
      "Dispatched to District Police Station & 112 PCR Patrol Unit"
    );
    if (!dispatchNote || !dispatchNote.trim()) return;

    setBusy(incident._id);
    setError("");
    try {
      const { data } = await nodeApi.patch(`/incidents/${incident._id}/status`, {
        status: "responding",
        note: `🚨 Police Dispatched by Admin: ${dispatchNote.trim()}`,
      });
      setIncidents((rows) => [data, ...rows.filter((row) => row._id !== data._id)]);
      window.alert(`Incident #${incident.incidentRef} dispatched to police successfully.`);
    } catch (err) {
      setError(err.response?.data?.error || "Could not record police dispatch.");
    } finally {
      setBusy("");
    }
  };

  return (
    <AdminLayout>
      <main className="incident-console">
        <div className="page-title-row">
          <div>
            <p className="ops-kicker">LIVE RESPONSE</p>
            <h1>Emergency incidents</h1>
            <p>MongoDB records · updates delivered through authenticated realtime channels</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="ops-button"
              style={{ background: "#7c3aed", color: "#fff", borderColor: "#6d28d9", fontWeight: 700 }}
              onClick={() => setShowSmsModal(true)}
            >
              📥 Ingest Offline SMS Beacon
            </button>
            <button className="ops-button subtle" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "↻ Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {error ? <p className="notice danger-note">{error}</p> : null}

        {loading ? (
          <p>Loading incidents…</p>
        ) : incidents.length ? (
          incidents.map((incident) => {
            const isOffline =
              incident.message?.includes("OFFLINE") ||
              incident.incidentRef?.includes("OFFLINE") ||
              incident.incidentRef?.includes("SMS") ||
              incident.message?.includes("Offline") ||
              incident.message?.includes("INBOUND CELLULAR SMS") ||
              incident.message?.includes("SMS BEACON");

            const assignedList = incident.assignedPolice || [];
            const isPoliceConfirmed = incident.policeConfirmed;
            const chosenForThis = selectedOfficers[incident._id] || [];

            return (
              <article className="panel incident-admin-card" key={incident._id}>
                <div className="panel-header">
                  <span>
                    {incident.incidentRef} · {incident.status}
                  </span>
                  <span>{new Date(incident.createdAt).toLocaleString()}</span>
                </div>

                <div className="panel-body">
                  <div className="incident-summary">
                    <div>
                      {isOffline && (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: "rgba(245, 158, 11, 0.15)",
                            border: "1px solid #f59e0b",
                            color: "#f59e0b",
                            fontWeight: "bold",
                            fontSize: "0.85rem",
                            marginBottom: 8,
                          }}
                        >
                          <span>📴 OFFLINE SMS BEACON (No cellular data/internet on device)</span>
                        </div>
                      )}

                      <h2>{incident.tourist?.name || "Tourist"}</h2>
                      <p>
                        {incident.tourist?.digitalId || "Digital ID unavailable"} ·{" "}
                        {incident.tourist?.phone || "No phone"}
                      </p>
                      <p style={{ fontWeight: isOffline ? "600" : "normal" }}>{incident.message}</p>
                      <b>Severity: {incident.severity}</b>
                      {incident.assignedName ? <p>Responder: {incident.assignedName}</p> : null}
                    </div>

                    {incident.location?.latitude != null ? (
                      <div
                        style={{
                          marginTop: 6,
                          padding: "8px 12px",
                          background: "#f0fdf4",
                          border: "1px solid #86efac",
                          borderRadius: 6,
                        }}
                      >
                        <p style={{ margin: 0, color: "#15803d", fontWeight: "bold" }}>
                          📍 Coordinates: Lat {Number(incident.location.latitude).toFixed(6)}, Lng{" "}
                          {Number(incident.location.longitude).toFixed(6)}
                        </p>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-block",
                            marginTop: 4,
                            color: "#2563eb",
                            textDecoration: "underline",
                            fontSize: "0.88rem",
                          }}
                          href={`https://www.google.com/maps?q=${incident.location.latitude},${incident.location.longitude}`}
                        >
                          View on Google Maps ↗
                        </a>
                      </div>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Location unavailable</span>
                    )}
                  </div>

                  {/* 🚔 ASSIGNED POLICE OFFICERS & REALTIME CONFIRMATION STATUS */}
                  {assignedList.length > 0 && (
                    <div
                      style={{
                        background: "#eff6ff",
                        border: "1px solid #93c5fd",
                        borderRadius: 8,
                        padding: "12px 14px",
                        margin: "12px 0",
                      }}
                    >
                      <b style={{ color: "#1e40af", fontSize: "0.9rem" }}>
                        🚔 ASSIGNED POLICE OFFICERS ({assignedList.length}):
                      </b>
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {assignedList.map((p, idx) => {
                          const isEnRoute = p.status === "en_route" || (isPoliceConfirmed && idx === 0);
                          const isArrived = p.status === "arrived";
                          const isResolved = p.status === "resolved";

                          return (
                            <div
                              key={idx}
                              style={{
                                background: "#fff",
                                border: "1px solid #bfdbfe",
                                borderRadius: 6,
                                padding: "8px 12px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              <div>
                                <b style={{ color: "#0f172a" }}>👮 {p.name}</b>
                                <span style={{ color: "#64748b", fontSize: "0.85rem", marginLeft: 6 }}>
                                  ({p.station || p.badge}) · 📞 {p.phone || "112"}
                                </span>
                                {p.policeNote ? (
                                  <p style={{ margin: "3px 0 0", color: "#1d4ed8", fontSize: "0.84rem" }}>
                                    Officer Note: "{p.policeNote}"
                                  </p>
                                ) : null}
                              </div>

                              <div>
                                {isEnRoute && (
                                  <span
                                    style={{
                                      background: "#3b82f6",
                                      color: "#fff",
                                      fontSize: "0.78rem",
                                      fontWeight: "bold",
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    🚨 EN ROUTE (CONFIRMED)
                                  </span>
                                )}
                                {isArrived && (
                                  <span
                                    style={{
                                      background: "#8b5cf6",
                                      color: "#fff",
                                      fontSize: "0.78rem",
                                      fontWeight: "bold",
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    📍 ARRIVED AT SCENE
                                  </span>
                                )}
                                {isResolved && (
                                  <span
                                    style={{
                                      background: "#10b981",
                                      color: "#fff",
                                      fontSize: "0.78rem",
                                      fontWeight: "bold",
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    ✅ RESOLVED
                                  </span>
                                )}
                                {!isEnRoute && !isArrived && !isResolved && (
                                  <span
                                    style={{
                                      background: "#f59e0b",
                                      color: "#fff",
                                      fontSize: "0.78rem",
                                      fontWeight: "bold",
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    ⏳ Awaiting Police Confirmation
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 👮 ASSIGN MULTIPLE POLICE OFFICERS PANEL (Admin Control) */}
                  {incident.status !== "resolved" && incident.status !== "cancelled" && (
                    <div
                      style={{
                        background: "#fafafa",
                        border: "1px dashed #cbd5e1",
                        borderRadius: 8,
                        padding: "12px 14px",
                        margin: "12px 0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <b style={{ fontSize: "0.88rem", color: "#334155" }}>
                          👮 Assign Police Officers to this SOS Alert:
                        </b>
                        <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                          Check one or multiple officers to dispatch
                        </span>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                        {policeOfficers.map((off) => {
                          const isSelected = chosenForThis.includes(off._id);
                          const isAlreadyAssigned = assignedList.some(
                            (p) => String(p.officer) === String(off._id)
                          );

                          return (
                            <button
                              key={off._id}
                              type="button"
                              onClick={() => toggleOfficerSelect(incident._id, off._id)}
                              style={{
                                background: isSelected
                                  ? "#1e40af"
                                  : isAlreadyAssigned
                                  ? "#f1f5f9"
                                  : "#ffffff",
                                color: isSelected ? "#ffffff" : isAlreadyAssigned ? "#94a3b8" : "#0f172a",
                                border: isSelected
                                  ? "1px solid #1e40af"
                                  : isAlreadyAssigned
                                  ? "1px solid #cbd5e1"
                                  : "1px solid #94a3b8",
                                borderRadius: 6,
                                padding: "6px 10px",
                                fontSize: "0.82rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span>{isSelected ? "☑" : isAlreadyAssigned ? "✓ (Assigned)" : "☐"}</span>
                              <b>{off.name}</b>
                              <small>({off.policeStation?.split(",")[0] || off.policeBadge})</small>
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="Optional dispatch instruction note for assigned police..."
                          value={policeNotes[incident._id] || ""}
                          onChange={(e) =>
                            setPoliceNotes({ ...policeNotes, [incident._id]: e.target.value })
                          }
                          style={{
                            flex: 1,
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            fontSize: "0.85rem",
                          }}
                        />
                        <button
                          type="button"
                          className="ops-button"
                          disabled={busy === incident._id || !chosenForThis.length}
                          onClick={() => handleAssignPolice(incident)}
                          style={{
                            background: chosenForThis.length ? "#1e3a8a" : "#94a3b8",
                            color: "#fff",
                            fontWeight: "bold",
                            fontSize: "0.85rem",
                            padding: "7px 14px",
                          }}
                        >
                          {busy === incident._id
                            ? "Assigning..."
                            : `🚨 Assign (${chosenForThis.length}) Police Officers`}
                        </button>
                      </div>
                    </div>
                  )}

                  <label>
                    Response note
                    <textarea
                      rows="2"
                      maxLength="2000"
                      value={notes[incident._id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [incident._id]: event.target.value }))
                      }
                    />
                  </label>

                  <div
                    className="incident-actions"
                    style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
                  >
                    {incident.status !== "resolved" && incident.status !== "cancelled" && (
                      <button
                        type="button"
                        disabled={busy === incident._id}
                        className="ops-button danger"
                        style={{ background: "#dc2626", fontWeight: "bold" }}
                        onClick={() => dispatchToPolice(incident)}
                      >
                        🚨 Quick Dispatch 112
                      </button>
                    )}

                    {(actions[incident.status] || []).map(([status, title]) => (
                      <React.Fragment key={status}>
                        {status === "assigned" ? (
                          <select
                            aria-label="Assign responder"
                            value={assignments[incident._id] || ""}
                            onChange={(event) =>
                              setAssignments((current) => ({
                                ...current,
                                [incident._id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Select responder</option>
                            {responders.map((responder) => (
                              <option key={responder._id} value={responder._id}>
                                {responder.name} · {responder.email}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <button
                          disabled={
                            busy === incident._id ||
                            (status === "resolved" && !notes[incident._id]?.trim()) ||
                            (status === "assigned" && !assignments[incident._id])
                          }
                          className={
                            status === "resolved" || status === "cancelled"
                              ? "ops-button danger"
                              : "ops-button"
                          }
                          onClick={() => update(incident, status)}
                        >
                          {busy === incident._id ? "Saving…" : title}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  <details style={{ marginTop: 10 }}>
                    <summary>Incident history ({incident.history?.length || 0})</summary>
                    <ol>
                      {(incident.history || []).map((event, index) => (
                        <li key={`${event.at}-${index}`}>
                          {event.status} · {new Date(event.at).toLocaleString()} ·{" "}
                          {event.actorName || "System"}
                          {event.note ? ` — ${event.note}` : ""}
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>
              </article>
            );
          })
        ) : (
          <section className="panel">
            <div className="panel-body">No incidents recorded yet.</div>
          </section>
        )}
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
