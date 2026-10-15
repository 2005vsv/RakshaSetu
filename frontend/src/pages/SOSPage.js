import React, { useCallback, useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";

const actions = {
  new: [["acknowledged", "Acknowledge"], ["cancelled", "False report"]],
  acknowledged: [["assigned", "Assign to me"], ["responding", "Start response"], ["resolved", "Resolve"]],
  assigned: [["responding", "Start response"], ["resolved", "Resolve"]],
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
  const load = useCallback(async () => {
    try { const { data } = await nodeApi.get("/incidents"); setIncidents(data || []); setError(""); }
    catch (err) { setError(err.response?.data?.error || "Incident records could not load."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    let soundEnabled = false;
    nodeApi.get("/admin/settings").then(({ data }) => { soundEnabled = Boolean(data.alertSoundEnabled); }).catch(() => {});
    nodeApi.get("/admin/responders").then(({ data }) => setResponders(data || [])).catch(() => {});
    const socket = connectRealtime();
    const apply = ({ incident }) => setIncidents((rows) => [incident, ...rows.filter((row) => row._id !== incident._id)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    socket.on("incident:new", (payload) => {
      apply(payload);
      if (soundEnabled) {
        try { const AudioContextClass = window.AudioContext || window.webkitAudioContext; const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 740; gain.gain.value = 0.08; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.25); oscillator.onended = () => context.close(); } catch (_) { /* Browser audio may require a user gesture. */ }
      }
    });
    socket.on("incident:updated", apply);
    socket.on("connect", load);
    return () => socket.disconnect();
  }, [load]);
  const update = async (incident, status) => {
    setBusy(incident._id); setError("");
    try {
      const { data } = await nodeApi.patch(`/incidents/${incident._id}/status`, { status, note: notes[incident._id] || "", ...(status === "assigned" ? { responderId: assignments[incident._id] } : {}) });
      setIncidents((rows) => [data, ...rows.filter((row) => row._id !== data._id)]);
      setNotes((current) => ({ ...current, [incident._id]: "" }));
    } catch (err) { setError(err.response?.data?.error || "Incident could not be updated."); }
    finally { setBusy(""); nodeApi.get("/admin/responders").then(({ data }) => setResponders(data || [])).catch(() => {}); }
  };
  return <AdminLayout><main className="incident-console"><div className="page-title-row"><div><p className="ops-kicker">LIVE RESPONSE</p><h1>Emergency incidents</h1><p>MongoDB records · updates delivered through authenticated realtime channels</p></div><button className="ops-button subtle" onClick={load}>Refresh</button></div>{error ? <p className="notice danger-note">{error}</p> : null}{loading ? <p>Loading incidents…</p> : incidents.length ? incidents.map((incident) => <article className="panel incident-admin-card" key={incident._id}><div className="panel-header"><span>{incident.incidentRef} · {incident.status}</span><span>{new Date(incident.createdAt).toLocaleString()}</span></div><div className="panel-body"><div className="incident-summary"><div><h2>{incident.tourist?.name || "Tourist"}</h2><p>{incident.tourist?.digitalId || "Digital ID unavailable"} · {incident.tourist?.phone || "No phone"}</p><p>{incident.message}</p><b>Severity: {incident.severity}</b>{incident.assignedName ? <p>Responder: {incident.assignedName}</p> : null}</div>{incident.location?.latitude != null ? <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${incident.location.latitude}&mlon=${incident.location.longitude}#map=16/${incident.location.latitude}/${incident.location.longitude}`}>Open last known location</a> : <span>Location unavailable</span>}</div><label>Response note<textarea rows="2" maxLength="2000" value={notes[incident._id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [incident._id]: event.target.value }))} /></label><div className="incident-actions">{(actions[incident.status] || []).map(([status, title]) => <React.Fragment key={status}>{status === "assigned" ? <select aria-label="Assign responder" value={assignments[incident._id] || ""} onChange={(event) => setAssignments((current) => ({ ...current, [incident._id]: event.target.value }))}><option value="">Select responder</option>{responders.map((responder) => <option key={responder._id} value={responder._id}>{responder.name} · {responder.email}</option>)}</select> : null}<button disabled={busy === incident._id || (status === "resolved" && !notes[incident._id]?.trim()) || (status === "assigned" && !assignments[incident._id])} className={status === "resolved" || status === "cancelled" ? "ops-button danger" : "ops-button"} onClick={() => update(incident, status)}>{busy === incident._id ? "Saving…" : title}</button></React.Fragment>)}</div><details><summary>Incident history ({incident.history?.length || 0})</summary><ol>{(incident.history || []).map((event, index) => <li key={`${event.at}-${index}`}>{event.status} · {new Date(event.at).toLocaleString()} · {event.actorName || "System"}{event.note ? ` — ${event.note}` : ""}</li>)}</ol></details></div></article>) : <section className="panel"><div className="panel-body">No incidents recorded yet.</div></section>}</main></AdminLayout>;
}
