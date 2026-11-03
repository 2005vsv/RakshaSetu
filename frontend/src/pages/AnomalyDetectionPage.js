import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIconPng from "../marker-icon.png";

// Custom Leaflet Icons
const touristLatestIcon = new L.Icon({
  iconUrl: markerIconPng,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -32],
});

export default function AnomalyDetectionPage() {
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [busyAction, setBusyAction] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [bannerMessage, setBannerMessage] = useState(null);

  // Fetch anomalies list and stats
  const loadData = useCallback(async () => {
    try {
      const [anomRes, statsRes] = await Promise.all([
        nodeApi.get("/anomalies"),
        nodeApi.get("/anomalies/stats"),
      ]);

      if (anomRes.data?.success) {
        setAnomalies(anomRes.data.anomalies || []);
      }
      if (statsRes.data?.success) {
        setStats(statsRes.data.stats || null);
      }
    } catch (err) {
      console.error("Failed to load anomalies:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to real-time Socket.IO anomaly alerts
    const socket = connectRealtime();
    const handleNewAnomaly = (newDoc) => {
      setAnomalies((prev) => [newDoc, ...prev.filter((a) => a._id !== newDoc._id)]);
      loadData();
    };
    const handleUpdated = (upDoc) => {
      setAnomalies((prev) => prev.map((a) => (a._id === upDoc._id ? upDoc : a)));
      if (selectedAnomaly && selectedAnomaly._id === upDoc._id) {
        setSelectedAnomaly(upDoc);
      }
      loadData();
    };

    socket.on("anomaly:new", handleNewAnomaly);
    socket.on("anomaly:updated", handleUpdated);
    socket.on("anomaly:refresh", loadData);

    return () => socket.disconnect();
  }, [loadData, selectedAnomaly]);

  // Update Status / Resolution
  const handleUpdateStatus = async (anomalyId, newStatus) => {
    setBusyAction(true);
    try {
      const res = await nodeApi.put(`/anomalies/${anomalyId}/status`, {
        status: newStatus,
        resolutionNotes: resolutionText.trim() || undefined,
      });

      if (res.data?.success) {
        setBannerMessage({ type: "success", text: `Alert updated to "${newStatus}" successfully.` });
        setSelectedAnomaly(res.data.anomaly);
        setAnomalies((prev) =>
          prev.map((a) => (a._id === res.data.anomaly._id ? res.data.anomaly : a))
        );
        loadData();
      }
    } catch (err) {
      setBannerMessage({ type: "error", text: "Failed to update alert status." });
    } finally {
      setBusyAction(false);
    }
  };

  // Re-seed demo anomalies on demand
  const handleReSeed = async () => {
    setBusyAction(true);
    try {
      await nodeApi.post("/anomalies/seed-demo", { force: true });
      await loadData();
      setBannerMessage({ type: "success", text: "Reset and re-evaluated demo anomaly streams (T001–T005)." });
    } catch (err) {
      setBannerMessage({ type: "error", text: "Failed to seed demo anomalies." });
    } finally {
      setBusyAction(false);
    }
  };

  // Filtered rows
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      const matchesType = typeFilter === "all" || a.anomalyType === typeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (a.touristCode || "").toLowerCase().includes(q) ||
        (a.touristName || "").toLowerCase().includes(q) ||
        (a.anomalyTypeLabel || "").toLowerCase().includes(q) ||
        (a.details || "").toLowerCase().includes(q);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [anomalies, statusFilter, typeFilter, searchQuery]);

  return (
    <AdminLayout>
      <div className="ops-page">
        {/* Header */}
        <div className="ops-heading">
          <div>
            <span className="ops-kicker">UNSUPERVISED MOVEMENT INTELLIGENCE</span>
            <h1>AI Anomaly Detection</h1>
            <p>
              Ensemble of 100 Isolation Trees (iTrees) evaluating GPS vectors alongside geofencing rules.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="ops-button subtle"
              onClick={handleReSeed}
              disabled={busyAction}
            >
              🔄 Re-Run Isolation Forest Scan
            </button>
          </div>
        </div>

        {/* Banner */}
        {bannerMessage && (
          <div className={`ops-banner ${bannerMessage.type}`}>
            {bannerMessage.text}
            <button
              onClick={() => setBannerMessage(null)}
              style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Summary Stats */}
        <div className="ops-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <article>
            <span>Total Anomalies Detected</span>
            <b>{stats?.total ?? anomalies.length}</b>
            <small style={{ color: "#13745d" }}>Isolation Forest Model Active</small>
          </article>
          <article>
            <span>Restricted & Critical</span>
            <b style={{ color: "#dc2626" }}>{stats?.highPriority ?? 2}</b>
            <small style={{ color: "#dc2626" }}>Immediate Action Required</small>
          </article>
          <article>
            <span>Under Review</span>
            <b style={{ color: "#d97706" }}>{stats?.underReview ?? 2}</b>
            <small style={{ color: "#d97706" }}>Officer Assessing Situation</small>
          </article>
          <article>
            <span>Pending Resolution</span>
            <b style={{ color: "#2563eb" }}>{stats?.pending ?? 2}</b>
            <small style={{ color: "#2563eb" }}>Awaiting Initial Check</small>
          </article>
        </div>

        {/* Filter Controls */}
        <div className="ops-card">
          <div className="ops-card-head">
            <div>
              <h2>Tourist Movement Anomaly Queue</h2>
              <p>Real-time detection of route deviations, unusual inactivity, geofence breaches, and erratic speeds.</p>
            </div>
            <div className="ops-filters">
              <input
                type="text"
                placeholder="Search tourist (e.g. T001, Hampi)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "240px" }}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Under review">Under review</option>
                <option value="High priority">High priority</option>
                <option value="Verified">Verified</option>
                <option value="Resolved">Resolved</option>
                <option value="False positive">False positive</option>
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All Anomaly Types</option>
                <option value="route_deviation">Route deviation</option>
                <option value="unusual_inactivity">Unusual inactivity</option>
                <option value="restricted_zone_entry">Restricted-zone entry</option>
                <option value="unusual_speed">Unusual speed</option>
                <option value="unusual_activity_concentration">Activity concentration</option>
              </select>
            </div>
          </div>

          {/* Anomaly Table Matching Exact Specification */}
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Tourist</th>
                  <th>Anomaly</th>
                  <th>Anomaly Score</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Detection Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="ops-empty">
                      Running Isolation Forest models...
                    </td>
                  </tr>
                ) : filteredAnomalies.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="ops-empty">
                      No matching anomalies found.
                    </td>
                  </tr>
                ) : (
                  filteredAnomalies.map((item) => {
                    const scorePct = Math.round((item.anomalyScore || 0.5) * 100);
                    const isHigh = item.anomalyScore >= 0.8 || item.status === "High priority";
                    const isMed = item.anomalyScore >= 0.65 && !isHigh;

                    let statusClass = "low";
                    if (item.status === "High priority" || item.priority === "High priority") statusClass = "high";
                    else if (item.status === "Under review") statusClass = "medium";
                    else if (item.status === "Resolved" || item.status === "Verified") statusClass = "resolved";

                    return (
                      <tr
                        key={item._id}
                        style={{
                          cursor: "pointer",
                          backgroundColor: selectedAnomaly?._id === item._id ? "#f0fdf4" : undefined,
                        }}
                        onClick={() => {
                          setSelectedAnomaly(item);
                          setResolutionText(item.resolutionNotes || "");
                        }}
                      >
                        <td>
                          <b>{item.touristCode}</b>
                          <small>{item.touristName}</small>
                        </td>
                        <td>
                          <b style={{ color: "#173d36" }}>{item.anomalyTypeLabel}</b>
                          <small numberOfLines={1}>
                            {item.details ? item.details.slice(0, 75) + "..." : "Movement outlier detected"}
                          </small>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              style={{
                                width: "65px",
                                height: "7px",
                                backgroundColor: "#e2e8f0",
                                borderRadius: "4px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${scorePct}%`,
                                  height: "100%",
                                  backgroundColor: isHigh ? "#dc2626" : isMed ? "#f59e0b" : "#3b82f6",
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: "700", fontSize: "11px" }}>
                              {item.anomalyScore.toFixed(2)}
                            </span>
                          </div>
                          <small style={{ color: isHigh ? "#dc2626" : "#64748b" }}>
                            {isHigh ? "High outlier" : isMed ? "Moderate" : "Normal"}
                          </small>
                        </td>
                        <td>
                          <span className={`ops-pill ${statusClass}`}>{item.status}</span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              color: isHigh ? "#b91c1c" : "#475569",
                            }}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {new Date(item.createdAt || item.latestLocation?.recordedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <small>
                            {new Date(item.createdAt || item.latestLocation?.recordedAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </small>
                        </td>
                        <td>
                          <button
                            className="ops-button subtle"
                            style={{ padding: "6px 12px", fontSize: "11px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAnomaly(item);
                              setResolutionText(item.resolutionNotes || "");
                            }}
                          >
                            Inspect Map 🗺️
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🗺️ INTERACTIVE ANOMALY INSPECTOR MODAL WITH LEAFLET MAP */}
        {selectedAnomaly && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
            }}
            onClick={() => setSelectedAnomaly(null)}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "1180px",
                maxHeight: "92vh",
                overflowY: "auto",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
                display: "grid",
                gridTemplateColumns: "1.05fr 1.35fr",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* LEFT COLUMN: DIAGNOSTIC & RESOLUTION PANEL */}
              <div
                style={{
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                  borderRight: "1px solid #e2e8f0",
                  backgroundColor: "#fcfdfd",
                  overflowY: "auto",
                  maxHeight: "90vh",
                }}
              >
                {/* Modal Title & Tourist ID */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "800",
                        color: "#0d9488",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      AI Anomaly Inspection
                    </span>
                    <h2 style={{ margin: "4px 0 2px", fontSize: "20px", color: "#0f172a" }}>
                      {selectedAnomaly.touristName} ({selectedAnomaly.touristCode})
                    </h2>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      📞 {selectedAnomaly.touristPhone || "+91 98765 43210"}
                    </span>
                  </div>
                  <span
                    className={`ops-pill ${
                      selectedAnomaly.status === "High priority"
                        ? "high"
                        : selectedAnomaly.status === "Under review"
                        ? "medium"
                        : "resolved"
                    }`}
                    style={{ fontSize: "11px", padding: "5px 10px" }}
                  >
                    {selectedAnomaly.status}
                  </span>
                </div>

                {/* Anomaly Score Card */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                      ANOMALY TYPE:
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "800",
                        color:
                          selectedAnomaly.anomalyScore >= 0.8
                            ? "#dc2626"
                            : selectedAnomaly.anomalyScore >= 0.65
                            ? "#d97706"
                            : "#2563eb",
                      }}
                    >
                      {selectedAnomaly.anomalyTypeLabel}
                    </span>
                  </div>

                  {/* Meter Bar */}
                  <div style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                      <span>Isolation Forest Score:</span>
                      <b>{selectedAnomaly.anomalyScore.toFixed(3)} / 1.000</b>
                    </div>
                    <div style={{ width: "100%", height: "9px", backgroundColor: "#e2e8f0", borderRadius: "5px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.round(selectedAnomaly.anomalyScore * 100)}%`,
                          height: "100%",
                          backgroundColor:
                            selectedAnomaly.anomalyScore >= 0.8
                              ? "#dc2626"
                              : selectedAnomaly.anomalyScore >= 0.65
                              ? "#f59e0b"
                              : "#3b82f6",
                        }}
                      />
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: "12px", color: "#334155", lineHeight: "1.5" }}>
                    {selectedAnomaly.details}
                  </p>
                </div>

                {/* Latest Location Details */}
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>
                    📍 Latest GPS Coordinates
                  </span>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>
                    {selectedAnomaly.latestLocation?.latitude?.toFixed(6)},{" "}
                    {selectedAnomaly.latestLocation?.longitude?.toFixed(6)}
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                    {selectedAnomaly.latestLocation?.address || "Belagavi Heritage Safety Perimeter, Karnataka"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                    Timestamp:{" "}
                    {new Date(
                      selectedAnomaly.latestLocation?.recordedAt || selectedAnomaly.createdAt
                    ).toLocaleString()}
                  </div>
                </div>

                {/* Isolation Forest Movement Features Breakdown */}
                {selectedAnomaly.features && (
                  <div style={{ backgroundColor: "#f1f5f9", borderRadius: "12px", padding: "12px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "800", color: "#475569", letterSpacing: "0.06em" }}>
                      FEATURE VECTOR VALUES:
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                      <div style={{ fontSize: "11px", color: "#334155" }}>
                        • Velocity: <b>{selectedAnomaly.features.speedKmh} km/h</b>
                      </div>
                      <div style={{ fontSize: "11px", color: "#334155" }}>
                        • Acceleration: <b>{selectedAnomaly.features.acceleration} m/s²</b>
                      </div>
                      <div style={{ fontSize: "11px", color: "#334155" }}>
                        • Bearing Turn: <b>{selectedAnomaly.features.bearingChangeDeg}°</b>
                      </div>
                      <div style={{ fontSize: "11px", color: "#334155" }}>
                        • Inactivity: <b>{selectedAnomaly.features.inactivityMinutes} mins</b>
                      </div>
                    </div>
                  </div>
                )}

                {/* Verification & Resolution Controls */}
                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#334155", textTransform: "uppercase" }}>
                    Verification & Resolution Actions:
                  </span>

                  <textarea
                    rows="2"
                    placeholder="Enter resolution notes, police dispatch remarks, or tourist contact log..."
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      padding: "8px",
                      fontSize: "12px",
                      fontFamily: "inherit",
                    }}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button
                      className="ops-button"
                      style={{ backgroundColor: "#d97706" }}
                      onClick={() => handleUpdateStatus(selectedAnomaly._id, "Under review")}
                      disabled={busyAction}
                    >
                      Mark Under Review
                    </button>
                    <button
                      className="ops-button"
                      style={{ backgroundColor: "#0284c7" }}
                      onClick={() => handleUpdateStatus(selectedAnomaly._id, "Verified")}
                      disabled={busyAction}
                    >
                      Verify & Alert Patrol
                    </button>
                    <button
                      className="ops-button"
                      style={{ backgroundColor: "#16a34a" }}
                      onClick={() => handleUpdateStatus(selectedAnomaly._id, "Resolved")}
                      disabled={busyAction}
                    >
                      Resolve Anomaly ✓
                    </button>
                    <button
                      className="ops-button subtle"
                      onClick={() => handleUpdateStatus(selectedAnomaly._id, "False positive")}
                      disabled={busyAction}
                    >
                      False Positive
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: INTERACTIVE LEAFLET MAP */}
              <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
                {/* Map Header Overlay */}
                <div
                  style={{
                    padding: "14px 20px",
                    backgroundColor: "#ffffff",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <b style={{ color: "#0f172a", fontSize: "14px" }}>Historical Breadcrumb GPS Trail</b>
                    <span style={{ display: "block", fontSize: "11px", color: "#64748b" }}>
                      Showing latest position (Red Pin) & 5 previous recorded points (Dotted Polyline)
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedAnomaly(null)}
                    style={{
                      border: "none",
                      backgroundColor: "#f1f5f9",
                      width: "32px",
                      height: "32px",
                      borderRadius: "16px",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "bold",
                      color: "#475569",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Leaflet Map Container */}
                <div style={{ flex: 1, minHeight: "480px" }}>
                  <MapContainer
                    center={[
                      selectedAnomaly.latestLocation?.latitude || 15.86421,
                      selectedAnomaly.latestLocation?.longitude || 74.52134,
                    ]}
                    zoom={15}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />

                    {/* Historical GPS Breadcrumbs Polyline */}
                    {selectedAnomaly.previousLocations && selectedAnomaly.previousLocations.length > 0 && (
                      <Polyline
                        positions={[
                          ...selectedAnomaly.previousLocations.map((p) => [p.latitude, p.longitude]),
                          [selectedAnomaly.latestLocation.latitude, selectedAnomaly.latestLocation.longitude],
                        ]}
                        pathOptions={{
                          color: "#ef4444",
                          weight: 4,
                          dashArray: "6, 8",
                          opacity: 0.85,
                        }}
                      />
                    )}

                    {/* Numbered Breadcrumb Markers for Previous Locations */}
                    {selectedAnomaly.previousLocations &&
                      selectedAnomaly.previousLocations.map((loc, idx) => (
                        <CircleMarker
                          key={idx}
                          center={[loc.latitude, loc.longitude]}
                          radius={6}
                          pathOptions={{
                            color: "#0369a1",
                            fillColor: "#38bdf8",
                            fillOpacity: 0.9,
                            weight: 2,
                          }}
                        >
                          <Popup>
                            <b>GPS Step -{idx + 1}</b>
                            <br />
                            Speed: {loc.speed ? loc.speed.toFixed(1) : "0"} km/h
                            <br />
                            Time: {new Date(loc.recordedAt).toLocaleTimeString()}
                            <br />
                            <small>{loc.stepNote || "Historic GPS Ping"}</small>
                          </Popup>
                        </CircleMarker>
                      ))}

                    {/* Latest Location Marker */}
                    <Marker
                      position={[
                        selectedAnomaly.latestLocation?.latitude || 15.86421,
                        selectedAnomaly.latestLocation?.longitude || 74.52134,
                      ]}
                      icon={touristLatestIcon}
                    >
                      <Popup>
                        <div style={{ minWidth: "160px" }}>
                          <span style={{ color: "#dc2626", fontWeight: "800", fontSize: "11px" }}>
                            🚨 LATEST ANOMALY POSITION
                          </span>
                          <br />
                          <b>
                            {selectedAnomaly.touristName} ({selectedAnomaly.touristCode})
                          </b>
                          <br />
                          <span style={{ fontSize: "12px", color: "#334155" }}>
                            {selectedAnomaly.anomalyTypeLabel}
                          </span>
                          <br />
                          <b>Score: {selectedAnomaly.anomalyScore.toFixed(2)}</b>
                          <br />
                          <small>Speed: {selectedAnomaly.latestLocation?.speed || 0} km/h</small>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

