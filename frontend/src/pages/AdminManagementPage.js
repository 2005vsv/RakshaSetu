import React, { useCallback, useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";

const tabs = ["Tourists", "Police officers", "Support inbox", "Announcements", "Audit log", "System settings"];
export default function AdminManagementPage() {
  const [tab, setTab] = useState(tabs[0]);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", password: "", title: "", body: "", severity: "info" });
  const [touristDetail, setTouristDetail] = useState(null);
  const [adminRole, setAdminRole] = useState("");
  const [touristDraft, setTouristDraft] = useState({ name: "", phone: "" });
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState({ locationRetentionDays: 0, incidentRetentionDays: 0, alertRetentionDays: 0, auditRetentionDays: 0, alertSoundEnabled: false, criticalSeverityThreshold: "high" });
  const [supportDrafts, setSupportDrafts] = useState({});
  const load = useCallback(async () => {
    setError("");
    try {
      if (tab === "System settings") { const { data } = await nodeApi.get(`/admin/settings?_t=${Date.now()}`); setSettings(data); setRows([]); return; }
      const route = { Tourists: `/admin/users?search=${encodeURIComponent(query)}&_t=${Date.now()}`, "Police officers": `/admin/police?_t=${Date.now()}`, "Support inbox": `/admin/support?_t=${Date.now()}`, Announcements: `/admin/announcements?_t=${Date.now()}`, "Audit log": `/admin/audit?_t=${Date.now()}` }[tab];
      if (route) { const { data } = await nodeApi.get(route); setRows(data || []); }
    } catch (err) { setError(err.response?.data?.error || "Could not load this admin view."); }
  }, [query, tab]);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setTimeout(() => setRefreshing(false), 500); }
  };
  useEffect(() => { load(); }, [load]);
  useEffect(() => { nodeApi.get("/auth/me").then(({ data }) => setAdminRole(data.adminRole || "")); }, []);
  useEffect(() => {
    if (tab !== "Support inbox") return undefined;
    const socket = connectRealtime();
    const apply = ({ request }) => setRows((items) => [request, ...items.filter((item) => item._id !== request._id)]);
    socket.on("support:new", apply);
    socket.on("support:updated", apply);
    return () => socket.disconnect();
  }, [tab]);
  const act = async (request, success) => { setError(""); setMessage(""); try { await request(); setMessage(success); await load(); } catch (err) { setError(err.response?.data?.error || "Action could not be completed."); } };
  const submit = async (event) => {
    event.preventDefault();
    if (tab === "Announcements") await act(() => nodeApi.post("/admin/announcements", { title: draft.title, body: draft.body, severity: draft.severity }), "Announcement published to the tourist portal.");
    setDraft({ name: "", email: "", password: "", title: "", body: "", severity: "info" });
  };
  return <AdminLayout><main><div className="page-title-row"><div><p className="ops-kicker">SYSTEM OPERATIONS</p><h1>Management & system</h1></div></div><div className="management-tabs">{tabs.map((name) => <button className={tab === name ? "active" : ""} key={name} onClick={() => setTab(name)}>{name}</button>)}</div>{error ? <p className="notice danger-note">{error}</p> : null}{message ? <p className="notice">{message}</p> : null}
    {tab === "Tourists" ? <section className="panel"><div className="panel-body"><label>Search by name, email or Tourist ID<input value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="ops-button subtle" onClick={async () => { try { const { data } = await nodeApi.get("/admin/users/export.csv", { responseType: "blob" }); const url = URL.createObjectURL(data); const a = document.createElement("a"); a.href = url; a.download = "rakshasetu-tourists.csv"; a.click(); URL.revokeObjectURL(url); } catch (err) { setError(err.response?.data?.error || "Tourist export failed."); } }}>Export tourist CSV</button>{rows.map((row) => <article className="management-row" key={row._id}><div><b>{row.name}</b><p>{row.digitalId} · {row.email} · {row.phone}</p><small>{row.accountStatus} · {row.verificationStatus} · {new Date(row.createdAt).toLocaleDateString()}</small></div><div className="incident-actions"><button className="ops-button subtle" onClick={async () => { try { const { data } = await nodeApi.get(`/admin/users/${row._id}`); setTouristDetail(data); setTouristDraft({ name: data.user.name || "", phone: data.user.phone || "" }); } catch (err) { setError(err.response?.data?.error || "Tourist record unavailable."); } }}>Details</button><button className="ops-button subtle" onClick={() => act(() => nodeApi.patch(`/admin/users/${row._id}/verification`, { status: row.verificationStatus === "verified" ? "unverified" : "verified" }), "Tourist verification updated.")}>{row.verificationStatus === "verified" ? "Unverify" : "Verify ID"}</button><button className="ops-button subtle" onClick={() => { const reason = window.prompt("Reason for flagging this record:"); if (reason?.trim()) act(() => nodeApi.patch(`/admin/users/${row._id}/verification`, { status: "flagged", reason }), "Tourist record flagged."); }}>Flag</button><button className="ops-button subtle" onClick={() => act(() => nodeApi.patch(`/admin/users/${row._id}/status`, { status: row.accountStatus === "active" ? "suspended" : "active" }), `Tourist account ${row.accountStatus === "active" ? "suspended" : "reactivated"}.`)}>{row.accountStatus === "active" ? "Suspend" : "Reactivate"}</button></div></article>)}{touristDetail ? <section className="card"><button className="text-button" onClick={() => setTouristDetail(null)}>Close details</button><h2>{touristDetail.user.name} · {touristDetail.user.digitalId}</h2><p>{touristDetail.user.email} · {touristDetail.user.phone} · {touristDetail.user.accountStatus} · {touristDetail.user.verificationStatus}</p>{adminRole === "super_admin" ? <div className="form-grid"><label>Correct name<input value={touristDraft.name} onChange={(event) => setTouristDraft({ ...touristDraft, name: event.target.value })} /></label><label>Correct phone<input inputMode="numeric" maxLength="10" value={touristDraft.phone} onChange={(event) => setTouristDraft({ ...touristDraft, phone: event.target.value })} /></label><button className="ops-button" onClick={() => act(async () => { const { data } = await nodeApi.patch(`/admin/users/${touristDetail.user._id}/profile`, touristDraft); setTouristDetail((current) => ({ ...current, user: { ...current.user, ...data } })); }, "Profile correction saved and audited.")}>Save authorized correction</button></div> : null}{touristDetail.user.flagReason ? <p>Flag: {touristDetail.user.flagReason}</p> : null}<h3>Emergency contacts</h3>{touristDetail.user.emergencyContacts?.map((contact) => <p key={contact.phone}>{contact.name} · {contact.phone} · {contact.relation}</p>)}<h3>Trips</h3>{touristDetail.trips.map((trip) => <p key={trip._id}>{trip.startPoint} → {trip.destination} · {trip.status}</p>)}<h3>Incidents</h3>{touristDetail.incidents.map((item) => <p key={item._id}>{item.incidentRef} · {item.status} · {item.severity}</p>)}</section> : null}</div></section> : null}
    {tab === "Police officers" ? (
      <section className="panel panel-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", color: "#0f172a" }}>
              Registered Police Officers ({rows.length})
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
              Officers registered via the Police Portal who can be assigned to emergency SOS alerts and e-FIRs.
            </p>
          </div>
          <button className="ops-button subtle" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "↻ Refreshing…" : "↻ Refresh Officers"}
          </button>
        </div>

        {!rows.length ? (
          <p className="empty">No police officers registered yet. Police officers can register at /police/signup.</p>
        ) : (
          rows.map((row) => (
            <article
              className="management-row"
              key={row._id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                borderRadius: 8,
                marginBottom: 8,
                background: "var(--soft, #f8fafc)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <b style={{ fontSize: "1.05rem", color: "#0f172a" }}>👮 {row.name}</b>
                  <span
                    style={{
                      background: "#dbeafe",
                      color: "#1e40af",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.78rem",
                      fontWeight: "bold",
                    }}
                  >
                    {row.policeBadge || "PCR"}
                  </span>
                  <span
                    style={{
                      background: row.isAvailable !== false ? "#dcfce7" : "#fee2e2",
                      color: row.isAvailable !== false ? "#166534" : "#991b1b",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: "0.78rem",
                      fontWeight: "600",
                    }}
                  >
                    {row.isAvailable !== false ? "● Available on duty" : "○ Off duty"}
                  </span>
                </div>
                <p style={{ margin: "6px 0 2px", fontSize: "0.9rem", color: "var(--muted)" }}>
                  Station: <b style={{ color: "#334155" }}>{row.policeStation || "Belagavi Division"}</b> · Contact:{" "}
                  <b>{row.phone || "112"}</b> · Email: {row.email}
                </p>
                <small style={{ color: "#64748b" }}>
                  Active Dispatches:{" "}
                  <b style={{ color: row.activeCasesCount > 0 ? "#dc2626" : "#16a34a" }}>
                    {row.activeCasesCount || 0} active case(s)
                  </b>{" "}
                  · Rank: <b>{row.policeRank || "Officer"}</b>
                </small>
              </div>

              <div className="incident-actions" style={{ display: "flex", gap: 8 }}>
                <button
                  className="ops-button subtle"
                  onClick={() =>
                    act(
                      () =>
                        nodeApi.patch(`/admin/police/${row._id}/status`, {
                          isAvailable: row.isAvailable === false,
                        }),
                      "Officer duty status updated."
                    )
                  }
                >
                  {row.isAvailable === false ? "Mark Available" : "Mark Off-Duty"}
                </button>
                <button
                  className="ops-button subtle"
                  style={{ color: "#dc2626", borderColor: "#fca5a5" }}
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to remove ${row.name}?`)) {
                      act(() => nodeApi.delete(`/admin/police/${row._id}`), "Police officer removed.");
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    ) : null}
    {tab === "Support inbox" ? (
      <section className="panel panel-body">
        {!rows?.length ? (
          <p className="empty">No support requests found in inbox.</p>
        ) : (
          rows.map((item) => {
            const rawStatus = item?.status || "open";
            const displayStatus = String(rawStatus).replace(/_/g, " ");
            const currentStatus = supportDrafts[item._id]?.status || rawStatus;
            const currentResponse = supportDrafts[item._id]?.response ?? item.response ?? "";
            const touristName = typeof item.tourist === "object" ? item.tourist?.name : "Tourist";
            const touristEmail = typeof item.tourist === "object" ? item.tourist?.email : "";
            const touristDigitalId = typeof item.tourist === "object" ? item.tourist?.digitalId : "";

            return (
              <article className="card support-admin-card" key={item._id}>
                <div className="section-heading">
                  <h2>{item.subject || "Untitled Request"}</h2>
                  <span className={`pill ${rawStatus === "closed" ? "success" : rawStatus === "in_review" ? "warning" : "info"}`}>
                    {displayStatus}
                  </span>
                </div>
                <p>
                  <b>{touristName || "Tourist"}</b>
                  {touristEmail ? ` · ${touristEmail}` : ""}
                  {touristDigitalId ? ` · ID: ${touristDigitalId}` : ""}
                </p>
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{item.category || "General"}</span>
                  {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ""}
                </p>
                <div style={{ background: "var(--soft)", padding: "12px 14px", borderRadius: "8px", margin: "10px 0", border: "1px solid var(--line)" }}>
                  <p style={{ margin: 0 }}>{item.message}</p>
                </div>
                {item.response ? (
                  <p style={{ color: "#065f46", background: "#ecfdf5", padding: "8px 12px", borderRadius: "6px", fontSize: "0.9rem" }}>
                    <b>Previous response:</b> {item.response}
                  </p>
                ) : null}
                <label>
                  Response / resolution note
                  <textarea
                    rows={3}
                    maxLength={2000}
                    placeholder="Type your response to the tourist here..."
                    value={currentResponse}
                    onChange={(event) =>
                      setSupportDrafts((current) => ({
                        ...current,
                        [item._id]: { ...current[item._id], response: event.target.value }
                      }))
                    }
                  />
                </label>
                <div className="incident-actions" style={{ marginTop: "10px" }}>
                  <select
                    aria-label="Support status"
                    value={currentStatus}
                    onChange={(event) =>
                      setSupportDrafts((current) => ({
                        ...current,
                        [item._id]: { ...current[item._id], status: event.target.value }
                      }))
                    }
                  >
                    <option value="open">Open</option>
                    <option value="in_review">In review</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    className="ops-button"
                    onClick={() =>
                      act(
                        () =>
                          nodeApi.patch(`/admin/support/${item._id}`, {
                            status: currentStatus,
                            response: currentResponse
                          }),
                        "Support request updated."
                      )
                    }
                  >
                    Save response
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    ) : null}
    {tab === "Announcements" ? <><form className="panel panel-body" onSubmit={submit}><h2>Publish safety notice</h2><label>Title<input required maxLength="160" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>Message<textarea required maxLength="5000" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label><label>Priority<select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value })}><option value="info">Information</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select></label><button className="ops-button">Publish</button></form><section className="panel panel-body">{rows.map((row) => <article className="management-row" key={row._id}><div><b>{row.title}</b><p>{row.body}</p><small>{row.severity} · {new Date(row.createdAt).toLocaleString()}</small></div><button className="ops-button subtle" onClick={() => act(() => nodeApi.delete(`/admin/announcements/${row._id}`), "Announcement removed.")}>Remove</button></article>)}</section></> : null}
    {tab === "Audit log" ? <section className="panel panel-body">{rows.map((row) => <article className="management-row" key={row._id}><div><b>{row.action}</b><p>{row.actor?.name || row.actor?.email || "Administrator"} · {row.targetType} {row.targetId}</p><small>{new Date(row.createdAt).toLocaleString()}</small></div></article>)}</section> : null}
    {tab === "System settings" ? <form className="panel panel-body" onSubmit={(event) => { event.preventDefault(); act(() => nodeApi.patch("/admin/settings", settings).then(({ data }) => setSettings(data)), "System settings saved to MongoDB."); }}><h2>Operations preferences</h2><label className="switch-row"><span><b>Audible SOS notification</b><small>Play a short tone in this browser when a new incident arrives (browser audio policy applies).</small></span><input type="checkbox" checked={Boolean(settings.alertSoundEnabled)} onChange={(event) => setSettings({ ...settings, alertSoundEnabled: event.target.checked })} /></label><label>High-priority threshold<select value={settings.criticalSeverityThreshold} onChange={(event) => setSettings({ ...settings, criticalSeverityThreshold: event.target.value })}><option value="medium">Medium and above</option><option value="high">High and above</option><option value="critical">Critical only</option></select></label><h2>Retention policy</h2><p>Set a number of days to automatically delete older records once daily. Set 0 to retain indefinitely. Deletion cannot be undone; configure this only under your organization's retention policy.</p><div className="form-grid">{[["locationRetentionDays", "Location history"], ["incidentRetentionDays", "Incidents"], ["alertRetentionDays", "Safety alerts"], ["auditRetentionDays", "Audit log"]].map(([key, label]) => <label key={key}>{label} (days)<input type="number" min="0" max="3650" value={settings[key] ?? 0} onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })} /></label>)}</div><p>Configured policy is applied by the backend once per day and removal counts are written to the audit log.</p><button disabled={adminRole !== "super_admin"} className="ops-button">Save system settings</button>{adminRole !== "super_admin" ? <p>Only a super administrator can change retention settings.</p> : null}</form> : null}
  </main></AdminLayout>;
}
