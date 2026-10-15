import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { QRCodeSVG } from "qrcode.react";
import { clearApiToken, nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";

const travelModes = [["car", "Car"], ["bus", "Bus"], ["train", "Train"], ["flight", "Flight"], ["trekking", "Trekking"], ["other", "Other"]];

function normalizeUser(user) {
  return {
    ...user,
    emergencyContacts: user.emergencyContacts || [],
    preferences: {
      notifications: true,
      locationSharing: false,
      shareWithPolice: true,
      ...(user.preferences || {}),
    },
    touristRole: user.touristRole || "tourist",
  };
}

function normalizeAlert(alert) {
  const severity = alert.severity || alert.priority || (alert.type === "panic" || alert.type === "sos" ? "high" : "medium");
  return {
    ...alert,
    _id: alert._id || alert.id || `alert-${Date.now()}`,
    status: alert.status || (alert.is_resolved ? "resolved" : "active"),
    severity,
    createdAt: alert.createdAt || alert.timestamp || new Date().toISOString(),
    message: alert.message || "Safety alert created.",
  };
}

function normalizeTrip(trip) {
  return {
    ...trip,
    _id: trip._id || trip.id || `trip-${Date.now()}`,
    status: trip.status || "planned",
    startDate: trip.startDate ? String(trip.startDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
    endDate: trip.endDate ? String(trip.endDate).slice(0, 10) : "",
  };
}

function formatDate(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString();
}

function severityClass(value) {
  if (["high", "panic", "sos", "emergency"].includes(value)) return "danger";
  if (["medium", "geofence", "warning"].includes(value)) return "warning";
  return "success";
}

function getSafetyStatus(score) {
  if (score >= 80) return ["Safe", "success"];
  if (score >= 50) return ["Caution", "warning"];
  return ["At Risk", "danger"];
}

function SetMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 14);
  }, [center, map]);
  return null;
}

function AuthGateway({ onReady }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "", aadhaarNumber: "", role: "tourist" });
  const [contacts, setContacts] = useState([]);
  const [contactDraft, setContactDraft] = useState({ name: "", phone: "", relation: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => { Promise.resolve(nodeApi.get("/auth/demo-status")).then(({ data }) => setDemoEnabled(Boolean(data?.enabled))).catch(() => setDemoEnabled(false)); }, []);

  const addContact = () => {
    if (!contactDraft.name.trim() || !contactDraft.phone.trim() || !contactDraft.relation.trim()) {
      setError("Please fill every emergency contact field.");
      return;
    }
    setContacts((current) => [...current, { ...contactDraft, id: `contact-${Date.now()}` }]);
    setContactDraft({ name: "", phone: "", relation: "" });
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        if (!acceptedTerms) throw new Error("Please accept the terms and privacy policy.");
        if (form.password !== form.confirmPassword) throw new Error("Passwords must match.");
        if (!contacts.some((contact) => contact.phone !== "112")) throw new Error("Add at least one personal emergency contact.");
      }
      if (mode === "register" && !contacts.some((contact) => contact.phone !== "112")) throw new Error("Add at least one personal emergency contact.");
      const endpoint = mode === "register" ? "/auth/register" : "/auth/tourist-login";
      const payload = mode === "register"
        ? { name: form.name, email: form.email, password: form.password, role: "user", phone: form.phone, aadhaarNumber: form.aadhaarNumber, touristRole: form.role, emergencyContacts: contacts.filter((contact) => contact.phone !== "112"), preferences: { notifications: true, locationSharing: false, shareWithPolice: true } }
        : { email: form.email, password: form.password };
      const { data } = await nodeApi.post(endpoint, payload);
      const nextUser = normalizeUser(data.user);
      onReady(nextUser);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to continue. Please make sure the backend and MongoDB are running.");
    } finally {
      setLoading(false);
    }
  };

  const demoSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await nodeApi.post("/auth/demo-login", { role: "tourist" });
      onReady(normalizeUser(data.user));
    } catch (err) {
      setError(err.response?.data?.error || "Tourist demo sign-in is unavailable.");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page tourist-auth">
      <form className="auth-card web-auth-card" onSubmit={submit}>
        <p className="eyebrow">RAKSHASETU TOURIST</p>
        <h1>{mode === "signin" ? "Welcome Back" : "Create Account"}</h1>
        <p>{mode === "signin" ? "Sign in to continue to your safety dashboard." : "Set up your travel safety profile for web."}</p>
        {error ? <p className="notice danger-note">{error}</p> : null}
        <div className="segmented" aria-label="Authentication mode">
          <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign In</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
        </div>
        {mode === "register" ? (
          <div className="role-grid">
            {["tourist", "guide"].map((role) => (
              <button type="button" key={role} className={form.role === role ? "role-card selected" : "role-card"} onClick={() => update("role", role)}>
                <b>{role === "tourist" ? "Tourist" : "Guide"}</b>
                <span>{role === "tourist" ? "Travel monitoring" : "Group safety support"}</span>
              </button>
            ))}
          </div>
        ) : null}
        {mode === "register" ? <label>Full Name<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label> : null}
        <label>Email<input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
        {mode === "signin" ? <label>Password<input required minLength={8} type="password" value={form.password} onChange={(event) => update("password", event.target.value)} /></label> : null}
        {mode === "register" ? (
          <>
            <div className="form-grid">
              <label>Phone Number<input required pattern="[0-9]{10}" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
              <label>Aadhaar Number<input required pattern="[0-9]{12}" value={form.aadhaarNumber} onChange={(event) => update("aadhaarNumber", event.target.value)} /></label>
            </div>
            <div className="form-grid">
              <label>Password<input required minLength={8} type="password" value={form.password} onChange={(event) => update("password", event.target.value)} /></label>
              <label>Confirm Password<input required minLength={8} type="password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} /></label>
            </div>
            <section className="mini-panel">
              <div className="section-heading compact"><h2>Emergency Contacts</h2><span>{contacts.filter((contact) => contact.phone !== "112").length} saved Â· 112 is always available</span></div>
              {contacts.filter((contact) => contact.phone !== "112").map((contact) => <div className="contact-row" key={contact.id}><b>{contact.name}</b><span>{contact.phone} - {contact.relation}</span></div>)}
              <p className="muted">Add at least one personal contact to your account.</p>
              <div className="form-grid three-cols">
                <input placeholder="Name" value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} />
                <input placeholder="Phone" value={contactDraft.phone} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} />
                <input placeholder="Relation" value={contactDraft.relation} onChange={(event) => setContactDraft({ ...contactDraft, relation: event.target.value })} />
              </div>
              <button className="secondary" type="button" onClick={addContact}>Add Contact</button>
            </section>
              <label className="check-row"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span>I agree to the Terms, Conditions, and Privacy Policy.</span></label>
          </>
        ) : null}
        <button className="primary" disabled={loading}>{loading ? "Please wait..." : mode === "signin" ? "Continue as tourist" : "Create Account"}</button>
        {mode === "signin" ? <Link to="/forgot-password">Forgot password?</Link> : null}
        {mode === "signin" && demoEnabled ? <button className="secondary" type="button" disabled={loading} onClick={demoSignIn}>Continue with tourist demo</button> : null}
        <Link to="/login">Administrator sign-in</Link>
      </form>
    </div>
  );
}

function Home({ user, trips, alerts, incidents, currentLocation }) {
  const activeTrip = trips.find((trip) => trip.status === "active") || trips[0];
  const safetyScore = Math.max(45, 92 - alerts.filter((alert) => alert.status === "active" && ["high", "panic", "sos", "emergency"].includes(String(alert.severity || alert.type).toLowerCase())).length * 12 - alerts.filter((alert) => alert.status === "active" && ["medium", "warning", "geofence"].includes(String(alert.severity || alert.type).toLowerCase())).length * 5);
  const [status, statusTone] = getSafetyStatus(safetyScore);
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">SAFETY DASHBOARD</p>
          <h1>Hello, {user.name || "Tourist"}.</h1>
          <p>Your travel profile, SOS tools, live location, and safety alerts are now available from the web app.</p>
          <div className="hero-actions"><Link className="primary light" to="map">Open Map</Link><Link className="danger" to="sos">Emergency SOS</Link></div>
        </div>
        <div className={`score ${statusTone}`}><b>{safetyScore}</b><span>Safety score<br />{status}</span></div>
      </section>
      <section className="grid three">
        <article className="metric-card"><span>Active Trips</span><b>{trips.filter((trip) => trip.status === "active").length}</b></article>
        <article className="metric-card"><span>Open Incidents</span><b>{incidents.filter((incident) => !["resolved", "cancelled"].includes(incident.status)).length}</b></article>
        <article className="metric-card"><span>Location Sharing</span><b>{user.preferences.locationSharing && user.preferences.shareWithPolice ? currentLocation ? "Shared · browser active" : "On · waiting for GPS" : "Not shared with responders"}</b></article>
      </section>
      <section className="grid three action-grid">
        <Link className="action-tile" to="map"><b>Navigate</b><span>Live map and risk zones</span></Link>
        <Link className="action-tile" to="trips"><b>My Trips</b><span>Plan and track travel</span></Link>
        <Link className="action-tile" to="profile"><b>Contacts</b><span>Emergency profile</span></Link>
      </section>
      <section className="card"><div className="section-heading"><div><h2>Emergency contacts</h2><p>Call a trusted contact directly from your browser.</p></div><Link to="profile">Manage contacts</Link></div>{user.emergencyContacts?.length ? <div className="grid three">{user.emergencyContacts.map((contact) => <article className="contact-row" key={contact.id || contact._id || contact.phone}><div><b>{contact.name}</b><span>{contact.relation}</span></div><a className="secondary" href={`tel:${contact.phone}`}>Call {contact.phone}</a></article>)}</div> : <p className="empty">Add an emergency contact to your profile.</p>}</section>
      <div className="grid two">
        <section><div className="section-heading"><h2>Active Trip</h2><Link to="trips">View all</Link></div>{activeTrip ? <TripCard trip={activeTrip} compact /> : <p className="empty">No trips yet.</p>}</section>
        <section><div className="section-heading"><h2>Recent Alerts</h2><Link to="alerts">See all</Link></div>{alerts.slice(0, 3).map((alert) => <AlertRow alert={alert} key={alert._id} />)}</section>
      </div>
    </>
  );
}

function TripCard({ trip, compact }) {
  return (
    <article className="trip-card">
      <div className="trip-image" />
      <div className="trip-body">
        <div className="trip-topline"><h2>{trip.destination}</h2><span className={`pill ${trip.status === "completed" ? "success" : "info"}`}>{trip.status}</span></div>
        <p>{trip.description || `${trip.startPoint || "Start point"} to ${trip.destination}`}</p>
        <div className="meta-row"><span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span><span>{trip.modeOfTravel || "travel"}</span></div>
        {!compact ? <Link className="secondary" to="/tourist/map">Track Journey</Link> : null}
      </div>
    </article>
  );
}

function Trips({ trips, load }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ startPoint: "", destination: "", startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), modeOfTravel: "", description: "", additionalDestinations: [] });
  const [newStop, setNewStop] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const filteredTrips = trips.filter((trip) => {
      const matchesFilter = filter === "all" || trip.status === filter;
      const haystack = `${trip.destination} ${trip.startPoint || ""} ${trip.description || ""} ${(trip.additionalDestinations || []).join(" ")}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  });
  const submit = async (event) => {
    event.preventDefault();
    if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) { setMessage("End date must be on or after the start date."); return; }
    try {
      if (!draft.modeOfTravel) { setMessage("Choose a travel mode before creating your trip."); return; }
      await nodeApi.post("/trips", { ...draft, status: "planned" });
      await load();
      setMessage("Trip created and saved to MongoDB.");
      setShowForm(false);
    } catch {
      setMessage("Trip could not be saved. Please check the backend connection.");
    }
  };
  const updateTrip = async (trip, changes) => { setBusy(trip._id); setMessage(""); try { await nodeApi.patch(`/trips/${trip._id}`, changes); await load(); setMessage("Trip updated."); } catch (err) { setMessage(err.response?.data?.error || "Trip could not be updated."); } finally { setBusy(""); } };
  const deleteTrip = async (trip) => { if (!window.confirm(`Delete the trip to ${trip.destination}?`)) return; setBusy(trip._id); try { await nodeApi.delete(`/trips/${trip._id}`); await load(); setMessage("Trip deleted."); } catch (err) { setMessage(err.response?.data?.error || "Trip could not be deleted."); } finally { setBusy(""); } };
  return (
    <>
      <div className="page-title-row"><div><p className="eyebrow">TRIP SAFETY</p><h1>My Trips</h1></div><button className="primary" onClick={() => setShowForm((value) => !value)}>{showForm ? "Close" : "Plan Trip"}</button></div>
      {message ? <p className="notice">{message}</p> : null}
      {showForm ? (
        <form className="card form-card" onSubmit={submit}>
          <div className="form-grid"><label>Start Point<input required value={draft.startPoint} onChange={(event) => setDraft({ ...draft, startPoint: event.target.value })} /></label><label>Main Destination<input required value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} /></label></div>
          <div className="form-grid"><label>Start Date<input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label><label>End Date<input required type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label></div>
          <div className="mode-grid">{travelModes.map(([key, label]) => <button type="button" key={key} className={draft.modeOfTravel === key ? "mode-card selected" : "mode-card"} onClick={() => setDraft({ ...draft, modeOfTravel: key })}>{label}</button>)}</div>
          <label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <div className="inline-form"><input placeholder="Additional destination" value={newStop} onChange={(event) => setNewStop(event.target.value)} /><button type="button" className="secondary" onClick={() => { if (newStop.trim()) { setDraft({ ...draft, additionalDestinations: [...draft.additionalDestinations, newStop.trim()] }); setNewStop(""); } }}>Add Stop</button></div>
          <div className="chip-row">{draft.additionalDestinations.map((stop) => <span className="pill info" key={stop}>{stop}</span>)}</div>
          <button className="primary">Create Trip</button>
        </form>
      ) : null}
      <div className="toolbar"><input placeholder="Search trips..." value={query} onChange={(event) => setQuery(event.target.value)} /><div className="chip-row">{["all", "planned", "active", "completed"].map((item) => <button className={filter === item ? "filter-chip active" : "filter-chip"} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="list-stack">{filteredTrips.length ? filteredTrips.map((trip) => <div className="trip-manage" key={trip._id}><TripCard trip={trip} /><div className="trip-manage-actions"><span className={`pill ${trip.status === "completed" ? "success" : trip.status === "active" ? "warning" : "info"}`}>{trip.status}</span>{trip.status === "planned" && <button className="secondary" disabled={busy === trip._id} onClick={() => updateTrip(trip, { status: "active" })}>Start trip</button>}{trip.status === "active" && <button className="secondary" disabled={busy === trip._id} onClick={() => updateTrip(trip, { status: "completed" })}>Complete trip</button>}<button className="danger" disabled={busy === trip._id} onClick={() => deleteTrip(trip)}>Delete</button></div></div>) : <p className="empty">No trips found.</p>}</div>
    </>
  );
}

function AlertRow({ alert }) {
  return <article className="alert-row"><b>{alert.type || "alert"}</b><span>{alert.message}</span><small>{new Date(alert.createdAt).toLocaleString()}</small><em className={`pill ${severityClass(alert.severity || alert.type)}`}>{alert.status || alert.severity}</em></article>;
}

function Alerts({ alerts, sendAlert }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const filtered = alerts.filter((alert) => {
    const matchesQuery = `${alert.type} ${alert.message}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || alert.status === filter || alert.severity === filter;
    return matchesQuery && matchesFilter;
  });
  return (
    <>
      <div className="page-title-row"><div><p className="eyebrow">ALERT CENTER</p><h1>Safety Alerts</h1></div><button disabled={sending} className="danger" onClick={async () => { setSending(true); setNotice(""); try { await sendAlert({ type: "panic", severity: "high", message: "Panic alert activated from alerts page." }); setNotice("Emergency alert saved to the response queue."); } catch (error) { setNotice(error.message); } finally { setSending(false); } }}>{sending ? "Sendingâ€¦" : "Send Panic Alert"}</button></div>
      {notice ? <p className="notice">{notice}</p> : null}
      <div className="toolbar"><input placeholder="Search alerts..." value={query} onChange={(event) => setQuery(event.target.value)} /><div className="chip-row">{["all", "active", "resolved", "high", "medium", "low"].map((item) => <button className={filter === item ? "filter-chip active" : "filter-chip"} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      {filtered.length ? filtered.map((alert) => <AlertRow alert={alert} key={alert._id} />) : <p className="empty">No alerts found.</p>}
    </>
  );
}

function TouristMap({ user, currentLocation, setCurrentLocation, sendAlert }) {
  const [tracking, setTracking] = useState(false);
  const [history, setHistory] = useState([]);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [riskZones, setRiskZones] = useState([]);
  const [message, setMessage] = useState("");
  const watchRef = useRef(null);
  const center = currentLocation ? [currentLocation.latitude, currentLocation.longitude] : [28.6139, 77.209];
  useEffect(() => {
    nodeApi.get("/zones", { params: { only_active: true } }).then(({ data }) => setRiskZones(data?.zones || [])).catch(() => setMessage("Geofence data could not be loaded from MongoDB."));
  }, []);
  const checkLocation = useCallback(async (next) => {
    try {
      const { data } = await nodeApi.post("/locations", { latitude: next.latitude, longitude: next.longitude, accuracy: next.accuracy, speed: next.speed, recordedAt: next.timestamp });
      setHistory((points) => [data, ...points].slice(0, 100).map((point) => ({ latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, speed: point.speed, timestamp: point.recordedAt })));
      const alerts = data.alerts || [];
      setMessage(alerts.length ? `Geofence warning: ${alerts.map((item) => item.zone_name || item.message).join(", ")}` : "Location saved to MongoDB. No active geofence warnings.");
      return alerts;
    } catch {
      setMessage("Location could not be saved to MongoDB.");
      return [];
    }
  }, []);
  useEffect(() => {
    nodeApi.get("/locations", { params: { limit: 100 } }).then(({ data }) => setHistory(data.map((point) => ({ latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, speed: point.speed, timestamp: point.recordedAt })))).catch(() => setMessage("Saved location history could not be loaded."));
  }, []);
  const capturePosition = () => {
    if (!user.preferences?.locationSharing) { setMessage("Enable Location Sharing in Profile & Privacy before sending your coordinates."); return; }
    if (!navigator.geolocation) {
      setMessage("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, speed: position.coords.speed, timestamp: new Date().toISOString() };
      setCurrentLocation(next);
      checkLocation(next);
    }, () => setMessage("Location permission was not granted."), { enableHighAccuracy: true });
  };
  useEffect(() => {
    if (!tracking) return undefined;
    if (!user.preferences?.locationSharing) { setMessage("Enable Location Sharing in Profile & Privacy before tracking."); setTracking(false); return undefined; }
    if (!navigator.geolocation) { setMessage("Geolocation is not available in this browser."); setTracking(false); return undefined; }
    watchRef.current = navigator.geolocation.watchPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, speed: position.coords.speed, timestamp: new Date().toISOString() };
      setCurrentLocation(next);
      checkLocation(next);
    }, () => setMessage("Tracking permission was not granted."), { enableHighAccuracy: true, maximumAge: 10000 });
    return () => navigator.geolocation.clearWatch(watchRef.current);
  }, [tracking, setCurrentLocation, checkLocation, user.preferences?.locationSharing]);
  return (
    <div className="map-page">
      <div className="map-panel">
        <div className="map-controls"><button className={tracking ? "danger" : "primary"} onClick={() => setTracking((value) => !value)}>{tracking ? "Stop Tracking" : "Start Tracking"}</button><button className="secondary" onClick={capturePosition}>Center</button><button className={showRiskZones ? "filter-chip active" : "filter-chip"} onClick={() => setShowRiskZones((value) => !value)}>Risk Zones</button><button className={showHistory ? "filter-chip active" : "filter-chip"} onClick={() => setShowHistory((value) => !value)}>History</button></div>
        <MapContainer className="tourist-map" center={center} zoom={13} scrollWheelZoom>
          <SetMapView center={center} />
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {currentLocation ? <Marker position={[currentLocation.latitude, currentLocation.longitude]}><Popup>Your location. Accuracy: {Math.round(currentLocation.accuracy || 0)}m</Popup></Marker> : null}
          {showHistory ? history.map((item, index) => <Circle key={`${item.timestamp}-${index}`} center={[item.latitude, item.longitude]} radius={18} pathOptions={{ color: "#64748b" }} />) : null}
          {showRiskZones ? riskZones.flatMap((zone) => {
            let geometry = zone.geometry || zone.geojson;
            if (typeof geometry === "string") { try { geometry = JSON.parse(geometry); } catch { return []; } }
            if (!geometry?.coordinates) return [];
            const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
            const color = zone.zone_type === "restricted" ? "#dc2626" : zone.zone_type === "risky" ? "#d97706" : "#15803d";
            return polygons.map((polygon, index) => <Polygon key={`${zone._id || zone.id}-${index}`} positions={polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng]))} pathOptions={{ color, fillColor: color, fillOpacity: 0.16 }}><Popup>{zone.name} Â· {zone.zone_type} zone</Popup></Polygon>);
          }) : null}
        </MapContainer>
      </div>
      <aside className="location-card">
        <h2>Location Info</h2>
        {message ? <p className="notice">{message}</p> : null}
        {currentLocation ? <><p><b>Latitude:</b> {currentLocation.latitude.toFixed(6)}</p><p><b>Longitude:</b> {currentLocation.longitude.toFixed(6)}</p><p><b>Accuracy:</b> {Math.round(currentLocation.accuracy || 0)}m</p><p><b>Speed:</b> {currentLocation.speed ? `${(currentLocation.speed * 3.6).toFixed(1)} km/h` : "N/A"}</p></> : <p className="empty">Enable location to see live coordinates.</p>}
        <h3>Emergency help</h3><p>Call <a href="tel:112">112</a> for immediate assistance. The nearby service directory is not configured.</p>
        <button className="danger" onClick={() => sendAlert({ type: "geofence", severity: "medium", message: "Manual risk-zone check requested.", status: "active" })}>Log Risk Alert</button>
      </aside>
    </div>
  );
}

function SOS({ sendAlert, currentLocation, setCurrentLocation, user }) {
  const [countdown, setCountdown] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sending, setSending] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearInterval(timerRef.current), []);
  const start = () => {
    setSent(false);
    setError(""); setConfirmation("");
    setCountdown(3);
    timerRef.current = setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          clearInterval(timerRef.current);
          setSending(true);
          const submit = async (location) => {
            try {
              const incident = await sendAlert({ type: "sos", severity: "high", status: "active", message: "Emergency SOS activated - assistance requested.", location: user.preferences?.locationSharing && user.preferences?.shareWithPolice ? location : null });
              setSent(true);
              setConfirmation(`Incident ${incident.incidentRef} submitted. Status: ${incident.status}.`);
            } catch (err) { setError(err.message || "SOS could not be saved. Call 112 if you need immediate help."); }
            finally { setSending(false); }
          };
          if (user.preferences?.locationSharing && user.preferences?.shareWithPolice && !currentLocation && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
              const location = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: new Date().toISOString() };
              setCurrentLocation(location);
              submit(location);
            }, () => submit(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 });
          } else submit(user.preferences?.locationSharing && user.preferences?.shareWithPolice ? currentLocation : null);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  };
  const cancel = () => {
    clearInterval(timerRef.current);
    setCountdown(0);
  };
  return (
    <div className="sos-page">
      <p className="eyebrow">EMERGENCY ALERT</p><h1>Request Immediate Help</h1><p>When activated, your alert is added to the safety feed and sent to the backend when connected.</p>
      {confirmation ? <p className="notice">{confirmation} <Link to="incidents">View incident updates</Link></p> : null}{error ? <p className="notice danger-note">{error} <a href="tel:112">Call 112</a>.</p> : null}
      {countdown ? <div className="countdown-card"><b>{countdown}</b><span>Sending in...</span><button className="secondary" onClick={cancel}>Cancel</button></div> : <button className="sos-button" disabled={sending} onClick={start}>{sending ? "SENDINGâ€¦" : sent ? "SEND AGAIN" : "SEND SOS"}</button>}
      <p><a className="secondary" href="tel:112">Call emergency services: 112</a></p>
      <div className="grid two"><article className="card"><h2>What Happens</h2><p>Your location, profile, and high-priority emergency alert are prepared for authorities and contacts.</p></article><article className="card"><h2>Important Notes</h2><p>Use SOS only for genuine emergencies. Keep location sharing and emergency contacts updated.</p></article></div>
    </div>
  );
}

function DigitalId({ user }) {
  const verifyUrl = `${window.location.origin}/verify/${encodeURIComponent(user.digitalId || "")}`;
  return <section className="card digital-id-page"><p className="eyebrow">VERIFIABLE TOURIST CREDENTIAL</p><h1>My Digital ID</h1><div className="id-card-print"><div><p>RakshaSetu Â· Tourist safety ID</p><h2>{user.name || "Tourist"}</h2><code className="digital-id">{user.digitalId || "DIG-PENDING"}</code><p>Status: <b>{user.accountStatus || "active"}</b></p><p>Emergency contact: {user.emergencyContacts?.[0]?.name || "Add a contact in Profile"}</p></div><QRCodeSVG value={verifyUrl} size={156} includeMargin /></div><p className="muted">The QR code opens a limited verification page. It does not reveal your phone, contacts, or location.</p><button className="primary" onClick={() => window.print()}>Print / Save as PDF</button></section>;
}

function TouristIncidents({ incidents, onCancel }) {
  const [reasons, setReasons] = useState({});
  const [error, setError] = useState("");
  const cancel = async (id) => { try { setError(""); await onCancel(id, reasons[id] || ""); } catch (err) { setError(err.response?.data?.error || "Could not cancel this SOS."); } };
  return <><p className="eyebrow">RESPONSE UPDATES</p><h1>My Incidents</h1>{error ? <p className="notice danger-note">{error}</p> : null}{incidents.length ? incidents.map((incident) => <article className="card incident-card" key={incident._id}><div className="section-heading"><h2>{incident.incidentRef}</h2><span className={`pill ${incident.status === "resolved" ? "success" : "warning"}`}>{incident.status}</span></div><p>{incident.message}</p><p>Submitted {new Date(incident.createdAt).toLocaleString()}</p>{incident.assignedName ? <p>Assigned responder: {incident.assignedName}</p> : null}{incident.resolution ? <p>Resolution: {incident.resolution}</p> : null}{incident.status === "new" ? <div className="cancel-incident"><label>Accidental alert? Explain briefly to close this report<textarea value={reasons[incident._id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [incident._id]: event.target.value }))} maxLength={500} /></label><button className="secondary" onClick={() => cancel(incident._id)}>Cancel accidental alert</button></div> : null}<ol>{(incident.history || []).map((event, index) => <li key={`${event.at}-${index}`}>{event.status} Â· {new Date(event.at).toLocaleString()} {event.note ? `Â· ${event.note}` : ""}</li>)}</ol></article>) : <p className="empty">No incidents have been submitted.</p>}</>;
}

function SafetyInformation({ announcements, supportRequests, onSendSupport }) {
  const [draft, setDraft] = useState({ category: "technical", subject: "", message: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try { const request = await onSendSupport(draft); setNotice(`Support request ${request._id.slice(-6).toUpperCase()} submitted.`); setDraft({ category: "technical", subject: "", message: "" }); }
    catch (err) { setError(err.response?.data?.error || "Support request could not be submitted."); }
    finally { setBusy(false); }
  };
  return <><p className="eyebrow">TRAVEL SAFELY</p><h1>Safety information & help</h1><div className="grid two"><section className="card"><h2>Emergency support</h2><p>For immediate danger in India, call <a href="tel:112">112</a>. This website records an alert for authorized system operators; it does not automatically contact police or guarantee emergency response.</p><p>Tell your emergency contact where you are and follow instructions from local emergency services.</p></section><section className="card"><h2>Location and privacy</h2><p>Browser location is shared only after you opt in. Your browser can pause GPS updates when a tab is closed, suspended, offline, or denied permission.</p><p>Responders can view your location only when both Location Sharing and Share with Police are enabled. QR verification reveals only the public ID validity fields.</p></section><section className="card"><h2>Travel checklist</h2><ul><li>Keep emergency contacts current.</li><li>Share your trip plan with someone you trust.</li><li>Check your device charge and connectivity.</li><li>Use SOS only for a genuine emergency.</li></ul></section><section className="card"><h2>Common questions</h2><details><summary>Does SOS call emergency services?</summary><p>No. It records an incident for system operators. Call 112 directly when immediate assistance is needed.</p></details><details><summary>Can tracking run with my browser closed?</summary><p>No. This web application cannot guarantee background tracking outside an active browser session.</p></details><details><summary>How do I stop sharing?</summary><p>Turn off Location Sharing or Share with Police under Profile & Privacy. The server then removes your profile from the monitoring map.</p></details></section></div><section className="card"><h2>Contact support</h2><p>Messages are stored in your MongoDB account and reviewed by a monitoring officer. Do not use this form for emergencies.</p>{notice ? <p className="notice">{notice}</p> : null}{error ? <p className="notice danger-note">{error}</p> : null}<form className="support-form" onSubmit={submit}><label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="account">Account access</option><option value="privacy">Privacy and data</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label><label>Subject<input required minLength="3" maxLength="160" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /></label><label>Message<textarea required minLength="10" maxLength="3000" value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} /></label><button className="primary" disabled={busy}>{busy ? "Sending…" : "Submit support request"}</button></form>{supportRequests.length ? <div><h3>Your support requests</h3>{supportRequests.map((item) => <article className="support-request-row" key={item._id}><b>{item.subject}</b><span>{item.status.replace("_", " ")} · {new Date(item.createdAt).toLocaleString()}</span>{item.response ? <p>Response: {item.response}</p> : null}</article>)}</div> : <p className="empty">No support requests yet.</p>}</section><section><div className="section-heading"><h2>Official safety announcements</h2><span>Live updates from system administrators</span></div>{announcements.length ? announcements.map((item) => <article className="card" key={item._id}><span className={`pill ${item.severity === "urgent" ? "danger" : item.severity === "warning" ? "warning" : "info"}`}>{item.severity}</span><h3>{item.title}</h3><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></article>) : <p className="empty">No current announcements.</p>}</section></>;
}

function Profile({ user, setUser, signOut }) {
  const [name, setName] = useState(user.name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [contact, setContact] = useState({ name: "", phone: "", relation: "" });
  const contacts = user.emergencyContacts || [];
  const preferences = user.preferences || {};
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const persistUser = (nextUser) => {
    const normalized = normalizeUser(nextUser);
    setUser(normalized);
  };
  const updatePreference = async (key, value, input) => {
    try {
      const { data } = await nodeApi.patch("/auth/me", { preferences: { ...preferences, [key]: value } });
      persistUser(data);
      setMessage("Preference saved to MongoDB.");
    } catch {
      if (input) input.checked = !value;
      setMessage("Preference could not be saved. Please check the backend connection.");
    }
  };
  const saveProfile = async () => {
    setBusy(true);
    try {
      const { data } = await nodeApi.patch("/auth/me", { name, phone });
      persistUser(data);
      setMessage("Profile updated in MongoDB.");
    } catch {
      setMessage("Profile could not be saved. Please check the backend connection.");
    } finally { setBusy(false); }
  };
  const addContact = async () => {
    if (!contact.name.trim() || !contact.phone.trim() || !contact.relation.trim()) { setMessage("Enter a name, phone number, and relation for this contact."); return; }
    setBusy(true);
    try {
      const { data } = await nodeApi.patch("/auth/me", { emergencyContacts: [...contacts, contact] });
      persistUser(data);
      setContact({ name: "", phone: "", relation: "" });
      setMessage("Emergency contact saved to MongoDB.");
    } catch {
      setMessage("Emergency contact could not be saved. Please check the backend connection.");
    } finally { setBusy(false); }
  };
  const removeContact = async (item) => {
    setBusy(true);
    try {
      const { data } = await nodeApi.patch("/auth/me", { emergencyContacts: contacts.filter((entry) => entry !== item) });
      persistUser(data);
      setMessage("Emergency contact removed.");
    } catch { setMessage("Contact could not be removed."); }
    finally { setBusy(false); }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ user }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "safevoyage-tourist-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <p className="eyebrow">PROFILE</p><h1>Your Safety Profile</h1>{message ? <p className="notice">{message}</p> : null}
      <div className="grid two"><section className="card profile-card"><div className="avatar">{(user.name || "U").slice(0, 1).toUpperCase()}</div><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>Email<input disabled value={user.email || ""} /></label><span className="pill info">{(user.touristRole || "tourist").toUpperCase()}</span><button disabled={busy} className="primary" onClick={saveProfile}>{busy ? "Savingâ€¦" : "Save Changes"}</button></section><section className="card"><h2>Digital Tourist ID</h2><code className="digital-id">{user.digitalId || "DIG-PENDING"}</code><p>Issued by RakshaSetu</p><Link to="/tourist/id">View QR verification and print</Link></section></div>
      <section className="card"><div className="section-heading compact"><h2>Emergency Contacts</h2><span>{contacts.length} saved</span></div>{contacts.map((item) => <div className="contact-row" key={item.id || item._id || item.phone}><b>{item.name}</b><span>{item.phone} - {item.relation}</span><button className="text-button" disabled={busy || item.phone === "112"} onClick={() => removeContact(item)}>Remove</button></div>)}<div className="form-grid three-cols"><input placeholder="Name" value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} /><input placeholder="Phone" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /><input placeholder="Relation" value={contact.relation} onChange={(event) => setContact({ ...contact, relation: event.target.value })} /></div><button disabled={busy} className="secondary" onClick={addContact}>Add Contact</button></section>
      <section className="card settings-card"><h2>Settings</h2>{[["notifications", "Notifications", "Browser and in-app safety notices"], ["locationSharing", "Location Sharing", "Share location with authorities"], ["shareWithPolice", "Share with Police", "Allow police access during emergencies"]].map(([key, title, description]) => <label className="switch-row" key={key}><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={Boolean(preferences[key])} onChange={(event) => updatePreference(key, event.target.checked, event.target)} /></label>)}</section>
      <section className="card account-actions"><button className="secondary" onClick={exportData}>Export My Data</button><button className="danger" onClick={signOut}>Logout</button></section>
    </>
  );
}

export default function TouristPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [supportRequests, setSupportRequests] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loadError, setLoadError] = useState("");
  const navItems = useMemo(() => [["", "Home"], ["id", "Digital ID"], ["trips", "Trips"], ["incidents", "Incidents"], ["alerts", "Alerts"], ["map", "Map"], ["safety", "Safety & Help"], ["profile", "Profile"]], []);
  const load = async () => {
    const [tripResult, alertResult, incidentResult, announcementResult, supportResult] = await Promise.allSettled([nodeApi.get("/trips"), nodeApi.get("/alerts"), nodeApi.get("/incidents"), nodeApi.get("/announcements"), nodeApi.get("/support")]);
    if (tripResult.status === "fulfilled") setTrips((tripResult.value.data || []).map(normalizeTrip));
    if (alertResult.status === "fulfilled") setAlerts((alertResult.value.data || []).map(normalizeAlert));
    if (incidentResult.status === "fulfilled") setIncidents(incidentResult.value.data || []);
    if (announcementResult.status === "fulfilled") setAnnouncements(announcementResult.value.data || []);
    if (supportResult.status === "fulfilled") setSupportRequests(supportResult.value.data || []);
    if (tripResult.status === "rejected" || alertResult.status === "rejected" || incidentResult.status === "rejected" || announcementResult.status === "rejected" || supportResult.status === "rejected") setLoadError("Some safety data could not load. Check the Node API connection and your tourist session.");
    else setLoadError("");
  };
  useEffect(() => {
    const restore = async () => {
      try {
        const { data } = await nodeApi.get("/auth/me");
        if (data.role !== "user") return;
        const restored = normalizeUser(data);
        setUser(restored);
      } catch {
        clearApiToken();
      }
    };
    restore();
  }, []);
  useEffect(() => {
    if (user) load().catch(() => {});
  }, [user]);
  useEffect(() => {
    if (!user) return undefined;
    const socket = connectRealtime();
    const update = ({ incident }) => setIncidents((items) => [incident, ...items.filter((item) => item._id !== incident._id)]);
    socket.on("incident:new", update);
    socket.on("incident:updated", update);
    socket.on("announcement:published", ({ announcement }) => setAnnouncements((items) => [announcement, ...items.filter((item) => item._id !== announcement._id)]));
    socket.on("support:updated", ({ request }) => setSupportRequests((items) => [request, ...items.filter((item) => item._id !== request._id)]));
    return () => socket.disconnect();
  }, [user]);
  const ready = (nextUser) => {
    setUser(normalizeUser(nextUser));
    navigate("/tourist");
  };
  const sendAlert = async (alert) => {
    try {
      if (["sos", "panic"].includes(String(alert.type).toLowerCase())) {
        const { data } = await nodeApi.post("/incidents/sos", { message: alert.message, location: alert.location || null });
        setIncidents((items) => [data, ...items.filter((item) => item._id !== data._id)]);
        return data;
      }
      const { data } = await nodeApi.post("/alerts", { type: alert.type, severity: alert.severity, message: alert.message, geoLocation: alert.geoLocation });
      await load();
      return data;
    } catch {
      throw new Error("Alert could not be saved. Call 112 if you need immediate help.");
    }
  };
  const cancelIncident = async (id, reason) => {
    const { data } = await nodeApi.patch(`/incidents/${id}/cancel`, { reason });
    setIncidents((items) => [data, ...items.filter((item) => item._id !== data._id)]);
  };
  const sendSupport = async (request) => { const { data } = await nodeApi.post("/support", request); setSupportRequests((items) => [data, ...items]); return data; };
  const signOut = () => {
    nodeApi.post("/auth/logout").catch(() => {}).finally(() => clearApiToken());
    setUser(null);
    navigate("/tourist");
  };
  if (!user) return <Routes><Route path="*" element={<AuthGateway onReady={ready} />} /></Routes>;
  return (
    <div className="tourist-shell">
      <header className="tourist-header">
        <Link to="/tourist" className="brand">RakshaSetu <span>Tourist</span></Link>
        <nav>{navItems.map(([path, label]) => { const target = path ? `/tourist/${path}` : "/tourist"; const active = location.pathname === target; return <Link className={active ? "active" : ""} to={target} key={label}>{label}</Link>; })}</nav>
        <Link className="sos-nav-link" to="/tourist/sos">SOS</Link><div className="tourist-account"><span>{user.name || "Tourist"}</span><button className="text-button" onClick={signOut}>Sign out</button></div>
      </header>
      <main className="tourist-content">
        {loadError ? <p className="notice danger-note">{loadError}</p> : null}
        <Routes>
          <Route index element={<Home user={user} trips={trips} alerts={alerts} incidents={incidents} currentLocation={currentLocation} />} />
          <Route path="trips" element={<Trips trips={trips} load={load} />} />
          <Route path="id" element={<DigitalId user={user} />} />
          <Route path="incidents" element={<TouristIncidents incidents={incidents} onCancel={cancelIncident} />} />
          <Route path="alerts" element={<Alerts alerts={alerts} sendAlert={sendAlert} />} />
          <Route path="map" element={<TouristMap user={user} currentLocation={currentLocation} setCurrentLocation={setCurrentLocation} sendAlert={sendAlert} />} />
          <Route path="sos" element={<SOS sendAlert={sendAlert} currentLocation={currentLocation} setCurrentLocation={setCurrentLocation} user={user} />} />
          <Route path="safety" element={<SafetyInformation announcements={announcements} supportRequests={supportRequests} onSendSupport={sendSupport} />} />
          <Route path="profile" element={<Profile user={user} setUser={setUser} signOut={signOut} />} />
          <Route path="*" element={<Navigate to="/tourist" replace />} />
        </Routes>
      </main>
      <Link className="sos-float" to="sos">SOS</Link>
    </div>
  );
}

