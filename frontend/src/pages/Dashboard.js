import React, { useCallback, useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FloatingMenu from "../components/FloatingMenu";
import ndrfLogo from "../ndrf_India_png.png";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => nodeApi.get("/incidents/admin/metrics").then(({ data }) => { setMetrics(data); setError(""); }).catch((err) => setError(err.response?.data?.error || "Operations metrics are unavailable.")), []);
  useEffect(() => { load(); const socket = connectRealtime(); socket.on("incident:new", load); socket.on("incident:updated", load); socket.on("trip:updated", load); socket.on("tourist:registered", load); return () => socket.disconnect(); }, [load]);
  return (
    <AdminLayout>
      <div className="ops-home">
        <section className="ops-welcome"><div><p className="ops-kicker">SAFETY RESPONSE · ADMIN</p><h1>Good day, operator.</h1><p>Monitor incidents, review reports, manage risk boundaries, and coordinate response from one workspace.</p><span className="ops-live-dot">{error || "Live data connected to MongoDB"}</span></div><img src={ndrfLogo} alt="NDRF" /></section>
        <section className="grid three"><article className="metric-card"><span>Registered tourists</span><b>{metrics?.totalTourists ?? "—"}</b></article><article className="metric-card"><span>Sharing location</span><b>{metrics?.sharingTourists ?? "—"}</b></article><article className="metric-card"><span>Active trips</span><b>{metrics?.activeTrips ?? "—"}</b></article><article className="metric-card"><span>Open incidents</span><b>{metrics?.openIncidents ?? "—"}</b></article><article className="metric-card"><span>High priority open</span><b>{metrics?.highPriority ?? "—"}</b></article><article className="metric-card"><span>Average acknowledgement</span><b>{metrics?.averageAcknowledgementMinutes == null ? "—" : `${metrics.averageAcknowledgementMinutes.toFixed(1)} min`}</b></article></section>
        <section className="panel"><div className="panel-header">Recent SOS activity</div><div className="panel-body">{metrics?.recent?.length ? metrics.recent.map((item) => <p key={item._id}><b>{item.incidentRef}</b> · {item.tourist?.name || "Tourist"} · {item.status} · {new Date(item.createdAt).toLocaleString()}</p>) : <p>No incidents recorded yet.</p>}</div></section>
        <section className="panel"><div className="panel-header">Incident trend · last 30 days</div><div className="panel-body" style={{ height: 280 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={(metrics?.daily || []).map((item) => ({ date: item._id.slice(5), count: item.count }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#0f766e" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
        <div className="ops-section-title"><div><h2>Response tools</h2><p>Choose a workspace to continue.</p></div></div>
        <FloatingMenu center large />
      </div>
    </AdminLayout>
  );
}
