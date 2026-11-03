import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import apiClient from "../services/api";

export default function EFIRPage() {
  const [items, setItems] = useState([]);
  const [policeOfficers, setPoliceOfficers] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [efirs, officers] = await Promise.all([
        apiClient.nodeApi.get(`${apiClient.endpointsNode.efirPending}?_t=${Date.now()}`),
        apiClient.nodeApi.get(`/police/officers?_t=${Date.now()}`).catch(() => ({ data: [] })),
      ]);
      setItems(Array.isArray(efirs.data) ? efirs.data : []);
      setPoliceOfficers(Array.isArray(officers.data) ? officers.data : []);
    } catch (e) {
      setError(e.response?.data?.error || "Could not load E-FIR records. Check that the Node API is running.");
    } finally {
      setLoading(false);
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

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      items.filter(
        (item) =>
          (status === "all" || item.status === status) &&
          `${item.description || ""} ${item.filedBy?.name || item.filedBy || ""} ${item.phone || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [items, status, query]
  );

  const act = async (item, action, responder) => {
    setBusy(item._id);
    setError("");
    setNotice("");
    try {
      let response;
      if (action === "verify") {
        response = await apiClient.nodeApi.post(apiClient.endpointsNode.efirVerify(item._id));
      } else if (action === "assign") {
        response = await apiClient.nodeApi.post(`/efir/assign/${item._id}`, {
          inspectorId: responder._id || responder.id,
          inspectorName: `${responder.name}${responder.policeStation ? ` (${responder.policeStation.split(",")[0]})` : ""}`,
        });
      } else {
        response = await apiClient.nodeApi.post(`/efir/send/${item._id}`);
      }

      setItems((list) => list.map((record) => (record._id === item._id ? response.data : record)));
      setNotice(
        action === "send"
          ? response.data.smsResult?.success
            ? "Status update sent by SMS."
            : response.data.smsResult
            ? `Status updated, but SMS failed: ${response.data.smsResult.error || "provider rejected the message"}`
            : "Status updated; SMS credentials are not configured."
          : action === "assign"
          ? "Officer / Inspector assigned to E-FIR."
          : "E-FIR verified."
      );
    } catch (e) {
      setError(e.response?.data?.error || `Could not ${action} this E-FIR.`);
    } finally {
      setBusy("");
    }
  };

  const combinedResponders = useMemo(() => {
    return policeOfficers.map((p) => ({
      _id: p._id,
      name: `👮 ${p.name} (${p.policeStation?.split(",")[0] || p.policeBadge || "Police"})`,
      policeStation: p.policeStation,
      isPolice: true,
    }));
  }, [policeOfficers]);

  return (
    <AdminLayout>
      <main className="ops-page">
        <header className="ops-heading">
          <div>
            <p className="ops-kicker">CASE INTAKE & POLICE DISPATCH</p>
            <h1>E-FIR review & dispatch</h1>
            <p>Validate incoming reports, assign police officers or inspectors, and track field resolution.</p>
          </div>
          <button className="ops-button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "↻ Refreshing…" : "↻ Refresh records"}
          </button>
        </header>

        {error && <div className="ops-banner error">{error}</div>}
        {notice && <div className="ops-banner success">{notice}</div>}

        <section className="ops-stats">
          <article>
            <span>Records in workflow</span>
            <b>{items.length}</b>
          </article>
          <article>
            <span>Awaiting verification</span>
            <b>{items.filter((item) => item.status === "pending").length}</b>
          </article>
          <article>
            <span>Assigned to Police</span>
            <b>{items.filter((item) => item.status === "assigned").length}</b>
          </article>
        </section>

        <section className="ops-card">
          <div className="ops-card-head">
            <div>
              <h2>Incoming reports</h2>
              <p>Review case details and dispatch each report to police or inspectors.</p>
            </div>
            <div className="ops-filters">
              <input
                placeholder="Search filer, phone, or details"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All statuses</option>
                {["pending", "verified", "assigned", "sent"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Report & Emergency</th>
                  <th>Complainant</th>
                  <th>Filed</th>
                  <th>Workflow & Assigned Unit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <b>{item.description}</b>
                      <small>
                        {item.geoLocation?.nearestCity ||
                          (item.geoLocation
                            ? `📍 ${item.geoLocation.latitude.toFixed(4)}, ${item.geoLocation.longitude.toFixed(4)}`
                            : "Location unavailable")}
                      </small>
                    </td>
                    <td>
                      {item.filedBy}
                      <small>📞 {item.phone}</small>
                    </td>
                    <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span
                        className={`ops-pill ${
                          item.status === "pending"
                            ? "medium"
                            : item.status === "sent"
                            ? "resolved"
                            : "low"
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.assignedInspector?.name && (
                        <small style={{ display: "block", marginTop: 4, color: "#1e40af" }}>
                          {item.assignedInspector.name}
                        </small>
                      )}
                    </td>
                    <td className="ops-actions">
                      {item.status === "pending" && (
                        <button
                          className="ops-button subtle"
                          disabled={busy === item._id}
                          onClick={() => act(item, "verify")}
                        >
                          Verify
                        </button>
                      )}
                      {["verified", "assigned"].includes(item.status) && (
                        <select
                          aria-label="Assign police officer or inspector"
                          value=""
                          disabled={busy === item._id || !combinedResponders.length}
                          onChange={(e) => {
                            const person = combinedResponders.find(
                              (p) => String(p._id) === String(e.target.value)
                            );
                            if (person) act(item, "assign", person);
                          }}
                        >
                          <option value="">
                            {combinedResponders.length ? "👮 Assign Police Officer" : "No responders available"}
                          </option>
                          {combinedResponders.map((person) => (
                            <option key={person._id} value={person._id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {item.status === "assigned" && (
                        <button
                          className="ops-button"
                          disabled={busy === item._id}
                          onClick={() => act(item, "send")}
                        >
                          Send update
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan="5" className="ops-empty">
                      {loading
                        ? "Loading case records…"
                        : error
                        ? "E-FIR service unavailable"
                        : "No reports match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AdminLayout>
  );
}
