import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { QRCodeSVG } from "qrcode.react";
import { clearApiToken, nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";
import TouristAiAssistant from "../components/TouristAiAssistant";
import L from "leaflet";

const travelModes = [["car", "Car"], ["bus", "Bus"], ["train", "Train"], ["flight", "Flight"], ["trekking", "Trekking"], ["other", "Other"]];

function normalizeUser(user) {
  return {
    ...user,
    emergencyContacts: user.emergencyContacts || [],
    preferences: {
      notifications: true,
      locationSharing: true,
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

const geoObject = (geometry) => {
  if (!geometry) return null;
  if (typeof geometry === "object") return geometry;
  try { return JSON.parse(geometry); } catch { return null; }
};

const ringsFor = (zone) => {
  const geo = geoObject(zone?.geometry || zone?.geojson);
  if (!geo) return [];
  if (geo.type === "Polygon" && Array.isArray(geo.coordinates)) {
    return geo.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  }
  if (geo.type === "MultiPolygon" && Array.isArray(geo.coordinates)) {
    return geo.coordinates.flatMap((polygon) => polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng])));
  }
  return [];
};

const getZoneCenter = (zone) => {
  const rings = ringsFor(zone);
  if (!rings.length || !rings[0]?.length) return null;
  const pts = rings[0];
  const avgLat = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const avgLng = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  return [avgLat, avgLng];
};

const createTouristIcon = (name = "Tourist") => {
  const initial = String(name || "T").trim().slice(0, 1).toUpperCase();
  return L.divIcon({
    className: "tourist-custom-pin",
    html: `
      <div style="position: relative; width: 44px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; cursor: pointer;">
        <div style="position: absolute; top: 0; width: 40px; height: 40px; background: rgba(14, 165, 233, 0.4); border-radius: 50%;"></div>
        <div style="position: relative; width: 36px; height: 36px; background: linear-gradient(135deg, #0284c7, #0f172a); border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 14px; z-index: 2;">
          👤 ${initial}
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #0f172a; margin-top: -2px; z-index: 1;"></div>
      </div>
    `,
    iconSize: [44, 50],
    iconAnchor: [22, 48],
    popupAnchor: [0, -48]
  });
};

function SetMapView({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (center) {
      map.setView(center, zoom || 14);
    }
  }, [center, zoom, bounds, map]);
  return null;
}

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      if (e?.latlng) {
        onLocationSelect({
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.lng.toFixed(6)),
          accuracy: 5,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
  return null;
}

function AuthGateway({ onReady }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "", aadhaarNumber: "", role: "tourist" });
  const [contacts, setContacts] = useState([]);
  const [contactDraft, setContactDraft] = useState({ name: "", phone: "", relation: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

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

function Alerts({ alerts, sendAlert, currentLocation }) {
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
      <div className="page-title-row">
        <div><p className="eyebrow">ALERT CENTER</p><h1>Safety Alerts</h1></div>
        <button disabled={sending} className="danger" onClick={async () => {
          setSending(true);
          setNotice("");
          try {
            let loc = currentLocation;
            if (!loc && navigator.geolocation) {
              try {
                const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 }));
                loc = { latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)), accuracy: pos.coords.accuracy };
              } catch (_) {}
            }
            if (!loc) loc = { latitude: 28.6129, longitude: 77.2295, accuracy: 25 };
            const incident = await sendAlert({ type: "panic", severity: "high", message: "Panic alert activated from alerts page.", location: loc });
            setNotice(`Emergency alert saved with coordinates (${loc.latitude}, ${loc.longitude}). Reference: ${incident?.incidentRef || "saved"}`);
          } catch (error) {
            setNotice(error.message);
          } finally {
            setSending(false);
          }
        }}>{sending ? "Sending…" : "Send Panic Alert"}</button>
      </div>
      {notice ? <p className="notice">{notice}</p> : null}
      <div className="toolbar"><input placeholder="Search alerts..." value={query} onChange={(event) => setQuery(event.target.value)} /><div className="chip-row">{["all", "active", "resolved", "high", "medium", "low"].map((item) => <button className={filter === item ? "filter-chip active" : "filter-chip"} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      {filtered.length ? filtered.map((alert) => <AlertRow alert={alert} key={alert._id} />) : <p className="empty">No alerts found.</p>}
    </>
  );
}

function resolveDestinationCoords(dest) {
  if (!dest) return null;
  const str = String(dest).trim();
  const coordMatch = str.match(/([0-9]+\.[0-9]+)[,\s]+([0-9]+\.[0-9]+)/);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lng = Number(coordMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  }
  const s = str.toLowerCase();
  if (s.includes('tilakwadi') || s.includes('guruwar peth')) return { latitude: 15.835939, longitude: 74.501521 };
  if (s.includes('udyambag police')) return { latitude: 15.814980, longitude: 74.491220 };
  if (s.includes('udyambag') || s.includes('rajaram nagar') || s.includes('gogte')) return { latitude: 15.814500, longitude: 74.492000 };
  if (s.includes('kle') || s.includes('centenary')) return { latitude: 15.823900, longitude: 74.505500 };
  if (s.includes('civil hospital') || s.includes('bims')) return { latitude: 15.859000, longitude: 74.512000 };
  if (s.includes('fort') || s.includes('belagavi fort')) return { latitude: 15.858800, longitude: 74.521500 };
  if (s.includes('railway') || s.includes('station')) return { latitude: 15.858000, longitude: 74.509000 };
  if (s.includes('khade bazar') || s.includes('market')) return { latitude: 15.855000, longitude: 74.515000 };
  return { latitude: 15.835939, longitude: 74.501521 };
}

function TouristMap({ user, trips = [], load, currentLocation, setCurrentLocation, sendAlert }) {
  const activeTrip = useMemo(() => {
    return (trips || []).find((t) => t && t.status === "active") || null;
  }, [trips]);

  const [tripRoute, setTripRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if (!activeTrip || !currentLocation || currentLocation.latitude == null) {
      setTripRoute(null);
      return;
    }
    const dest = resolveDestinationCoords(activeTrip.destination);
    if (!dest) return;

    setRouteLoading(true);
    nodeApi.get("/locations/route", {
      params: {
        originLat: currentLocation.latitude,
        originLng: currentLocation.longitude,
        destLat: dest.latitude,
        destLng: dest.longitude,
        mode: "driving"
      }
    }).then(({ data }) => {
      if (data && data.success && data.geometry?.coordinates) {
        setTripRoute(data);
      }
    }).catch((e) => {
      console.warn("Failed to load trip route:", e.message);
    }).finally(() => {
      setRouteLoading(false);
    });
  }, [activeTrip, currentLocation]);

  const completeTrip = async () => {
    if (!activeTrip) return;
    try {
      await nodeApi.patch(`/trips/${activeTrip._id || activeTrip.id}`, { status: "completed" });
      setTripRoute(null);
      if (typeof load === "function") await load();
      setMessage("Trip marked completed! Route direction closed.");
    } catch (err) {
      setMessage("Could not complete trip: " + err.message);
    }
  };

  const [tracking, setTracking] = useState(false);
  const [history, setHistory] = useState([]);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [riskZones, setRiskZones] = useState([]);
  const [message, setMessage] = useState("");
  const [viewState, setViewState] = useState(null);
  const [activeZoneAlert, setActiveZoneAlert] = useState(null);
  const [loggingAlert, setLoggingAlert] = useState(false);
  const watchRef = useRef(null);
  const defaultCenter = currentLocation ? [currentLocation.latitude, currentLocation.longitude] : [28.6139, 77.209];

  const loadZones = useCallback(async () => {
    try {
      const { data } = await nodeApi.get("/zones", { params: { only_active: true } });
      const loaded = Array.isArray(data?.zones) ? data.zones : [];
      setRiskZones(loaded);
    } catch {
      setMessage("Geofence data could not be loaded from MongoDB.");
    }
  }, []);

  useEffect(() => {
    loadZones();
    const socket = connectRealtime();
    socket.on("geofence:created", loadZones);
    socket.on("geofence:updated", loadZones);
    socket.on("geofence:deactivated", loadZones);
    return () => socket.disconnect();
  }, [loadZones]);

  const checkInsideZones = useCallback((coords, zones) => {
    if (!coords || !zones?.length) return null;
    for (const z of zones) {
      const rings = ringsFor(z);
      for (const ring of rings) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [lati, lngi] = ring[i];
          const [latj, lngj] = ring[j];
          const crosses = ((lati > coords.latitude) !== (latj > coords.latitude)) &&
            (coords.longitude < ((lngj - lngi) * (coords.latitude - lati)) / ((latj - lati) || 1e-9) + lngi);
          if (crosses) inside = !inside;
        }
        if (inside) return z;
      }
    }
    return null;
  }, []);

  const checkLocation = useCallback(async (next) => {
    try {
      const { data } = await nodeApi.post("/locations", { latitude: next.latitude, longitude: next.longitude, accuracy: next.accuracy, speed: next.speed, recordedAt: next.timestamp || new Date().toISOString() });
      setHistory((points) => [data, ...points].slice(0, 100).map((point) => ({ latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, speed: point.speed, timestamp: point.recordedAt })));
      const alerts = data.alerts || [];
      setMessage(alerts.length ? `⚠️ Geofence warning: ${alerts.map((item) => item.zone_name || item.message).join(", ")}` : `📍 Location pinned (${next.latitude}, ${next.longitude}). Saved to safety system.`);
      return alerts;
    } catch {
      setMessage(`📍 Location set locally to ${next.latitude}, ${next.longitude}.`);
      return [];
    }
  }, []);

  useEffect(() => {
    nodeApi.get("/locations", { params: { limit: 100 } }).then(({ data }) => setHistory(data.map((point) => ({ latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, speed: point.speed, timestamp: point.recordedAt })))).catch(() => {});
  }, []);

  const onMapClick = (coords) => {
    setCurrentLocation(coords);
    const entered = checkInsideZones(coords, riskZones);
    if (entered) {
      setActiveZoneAlert(entered);
      setMessage(`🚨 ALERT: Pinned location is inside ${entered.zone_type.toUpperCase()} zone: "${entered.name}"!`);
    } else {
      setActiveZoneAlert(null);
    }
    checkLocation(coords);
  };

  const capturePosition = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported in this browser. You can click anywhere on the map to set your location pin.");
      return;
    }
    setMessage("Acquiring GPS coordinates from browser...");
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)), accuracy: position.coords.accuracy, speed: position.coords.speed, timestamp: new Date().toISOString() };
      setCurrentLocation(next);
      setViewState({ center: [next.latitude, next.longitude], zoom: 15 });
      checkLocation(next);
      setMessage(`📍 GPS acquired: ${next.latitude}, ${next.longitude}`);
    }, (err) => {
      console.warn("GPS error:", err.message);
      setMessage("Browser location permission was not granted. Click anywhere on the map to manually pin your exact position!");
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  useEffect(() => {
    if (!tracking) return undefined;
    if (!navigator.geolocation) { setMessage("Geolocation is not available in this browser."); setTracking(false); return undefined; }
    watchRef.current = navigator.geolocation.watchPosition((position) => {
      const next = { latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)), accuracy: position.coords.accuracy, speed: position.coords.speed, timestamp: new Date().toISOString() };
      setCurrentLocation(next);
      checkLocation(next);
    }, () => setMessage("Tracking permission was not granted. Click on the map to set location."), { enableHighAccuracy: true, maximumAge: 10000 });
    return () => navigator.geolocation.clearWatch(watchRef.current);
  }, [tracking, setCurrentLocation, checkLocation]);

  const fitAllZones = () => {
    const allPts = riskZones.flatMap(ringsFor).flat();
    if (currentLocation) allPts.push([currentLocation.latitude, currentLocation.longitude]);
    if (allPts.length) {
      const lats = allPts.map((p) => p[0]);
      const lngs = allPts.map((p) => p[1]);
      setViewState({ bounds: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]] });
      setMessage(`Map adjusted to show all ${riskZones.length} safety boundaries.`);
    } else {
      setMessage("No zones available to display.");
    }
  };

  const logRiskAlert = async () => {
    setLoggingAlert(true);
    try {
      let loc = currentLocation;
      if (!loc || loc.latitude == null) {
        loc = { latitude: 28.6129, longitude: 77.2295, accuracy: 25 };
        setCurrentLocation(loc);
      }
      const entered = checkInsideZones(loc, riskZones);
      const zoneMessage = entered
        ? `⚠️ Tourist reported hazard inside ${entered.name} (${entered.zone_type} zone). Immediate monitoring requested.`
        : `⚠️ Tourist safety concern / hazard logged at coordinates (${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}).`;

      const result = await sendAlert({
        type: "geofence",
        severity: entered?.zone_type === "restricted" ? "high" : "medium",
        message: zoneMessage,
        location: loc,
        status: "active"
      });
      setMessage(`✅ Risk alert submitted successfully! Ref ID: ${result._id || result.id || "Active"}. Emergency operators alerted.`);
    } catch (err) {
      setMessage(`❌ Failed to log alert: ${err.message || "Please check connection"}`);
    } finally {
      setLoggingAlert(false);
    }
  };

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">GEOSPATIAL NAVIGATION & SAFETY</p>
          <h1>Safety Map</h1>
          <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.95rem" }}>
            Live GPS positioning, admin safety boundaries, and immediate hazard dispatch.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className={tracking ? "danger" : "primary"}
            onClick={() => setTracking((value) => !value)}
          >
            {tracking ? "⏹ Stop Live GPS" : "▶ Start Live GPS"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={capturePosition}
          >
            📍 Center (Device GPS)
          </button>
        </div>
      </div>

      {activeZoneAlert ? (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #f87171",
          color: "#991b1b",
          padding: "12px 18px",
          borderRadius: "12px",
          marginBottom: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 4px 14px rgba(239, 68, 68, 0.12)"
        }}>
          <div>
            <b style={{ fontSize: "0.98rem" }}>🚨 RESTRICTED AREA WARNING:</b>
            <span style={{ marginLeft: "8px" }}>
              You have entered the <b>"{activeZoneAlert.name}"</b> ({activeZoneAlert.zone_type}) boundary!
            </span>
          </div>
          <button
            type="button"
            className="danger"
            style={{ minHeight: "34px", padding: "6px 14px", fontSize: "0.82rem" }}
            onClick={() => sendAlert({
              type: "geofence",
              severity: "high",
              message: `Emergency breach of ${activeZoneAlert.name}`,
              location: currentLocation,
              status: "active"
            })}
          >
            Call Help
          </button>
        </div>
      ) : null}

      {message ? <p className="notice" style={{ marginTop: 0, marginBottom: "18px" }}>{message}</p> : null}

      {activeTrip ? (
        <div style={{
          background: "#0f172a",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          color: "#ffffff",
          padding: "14px 18px",
          borderRadius: "12px",
          marginBottom: "18px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.2rem" }}>🛣️</span>
                <b style={{ fontSize: "1.05rem", color: "#38bdf8" }}>Active Trip: To {activeTrip.destination}</b>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.88rem", color: "#94a3b8" }}>
                {routeLoading
                  ? "Calculating shortest detour avoiding risk zones..."
                  : tripRoute
                  ? `Distance: ${(tripRoute.distanceMeters / 1000).toFixed(1)} km • ETA: ~${Math.round(tripRoute.durationSeconds / 60)} min`
                  : "Safe route active"}
              </p>
            </div>
            <button
              type="button"
              className="primary"
              style={{ background: "#059669", borderColor: "#059669", color: "#ffffff", fontWeight: "bold" }}
              onClick={completeTrip}
            >
              ✓ Complete Trip
            </button>
          </div>
          {tripRoute?.hazardAvoidanceActive ? (
            <div style={{
              marginTop: "10px",
              padding: "8px 12px",
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid #f59e0b",
              borderRadius: "8px",
              color: "#fbbf24",
              fontSize: "0.85rem",
              fontWeight: 600
            }}>
              🛡️ Safe Detour Active: Smallest distance path bypassing risk zone ({tripRoute.avoidedHazards?.join(", ") || "Hazard Area"}).
            </div>
          ) : tripRoute ? (
            <div style={{
              marginTop: "10px",
              padding: "8px 12px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid #10b981",
              borderRadius: "8px",
              color: "#34d399",
              fontSize: "0.85rem",
              fontWeight: 600
            }}>
              🛡️ Safe Direct Corridor: 0 risk zones on route.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="map-page">
        <div className="map-panel">
          <div className="map-controls-bar">
            <div className="chip-row">
              <button
                type="button"
                className={showRiskZones ? "filter-chip active" : "filter-chip"}
                onClick={() => setShowRiskZones((value) => !value)}
              >
                Risk Zones ({riskZones.length})
              </button>
              <button
                type="button"
                className="filter-chip"
                onClick={fitAllZones}
              >
                Fit All Zones ({riskZones.length})
              </button>
              <button
                type="button"
                className="filter-chip"
                onClick={() => { loadZones(); setMessage("Boundaries re-synced from database."); }}
              >
                🔄 Refresh
              </button>
              <button
                type="button"
                className={showHistory ? "filter-chip active" : "filter-chip"}
                onClick={() => setShowHistory((value) => !value)}
              >
                History Trail
              </button>
            </div>
            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>
              {currentLocation ? `📍 Lat: ${Number(currentLocation.latitude).toFixed(4)}, Lng: ${Number(currentLocation.longitude).toFixed(4)}` : "Click map to set pin"}
            </span>
          </div>

          <MapContainer className="tourist-map" center={defaultCenter} zoom={13} scrollWheelZoom>
            <SetMapView center={viewState?.center || defaultCenter} zoom={viewState?.zoom} bounds={viewState?.bounds} />
            <MapClickHandler onLocationSelect={onMapClick} />
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {tripRoute?.geometry?.coordinates ? (
              <>
                <Polyline
                  positions={tripRoute.geometry.coordinates.map((c) => [c[1], c[0]])}
                  pathOptions={{ color: tripRoute.hazardAvoidanceActive ? "#059669" : "#10b981", weight: 9, opacity: 0.7 }}
                />
                <Polyline
                  positions={tripRoute.geometry.coordinates.map((c) => [c[1], c[0]])}
                  pathOptions={{ color: "#2563eb", weight: 5, opacity: 1.0 }}
                />
              </>
            ) : null}
            {currentLocation ? (
              <Marker
                position={[currentLocation.latitude, currentLocation.longitude]}
                icon={createTouristIcon(user?.name)}
              >
                <Popup>
                  <div style={{ padding: 4 }}>
                    <b>Your Location Pin</b><br />
                    <span style={{ color: "#0f766e", fontWeight: "bold" }}>Lat: {currentLocation.latitude}, Lng: {currentLocation.longitude}</span><br />
                    Accuracy: {Math.round(currentLocation.accuracy || 0)}m
                    {activeZoneAlert ? <div style={{ color: "#dc2626", fontWeight: "bold", marginTop: 4 }}>⚠️ Inside: {activeZoneAlert.name}</div> : null}
                  </div>
                </Popup>
              </Marker>
            ) : null}
            {showHistory ? history.map((item, index) => <Circle key={`${item.timestamp}-${index}`} center={[item.latitude, item.longitude]} radius={18} pathOptions={{ color: "#64748b" }} />) : null}
            {showRiskZones ? riskZones.flatMap((zone) => {
              const color = zone.zone_type === "restricted" ? "#dc2626" : zone.zone_type === "risky" ? "#ea580c" : "#16a34a";
              return ringsFor(zone).map((ring, index) => (
                <Polygon
                  key={`${zone._id || zone.id}-${index}`}
                  positions={ring}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.30,
                    weight: 3,
                    dashArray: zone.zone_type === "restricted" ? "6, 6" : undefined
                  }}
                >
                  <Popup>
                    <div style={{ padding: 6, minWidth: 170 }}>
                      <b style={{ fontSize: "1.05rem", color }}>{zone.name}</b>
                      <div style={{
                        display: "inline-block",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        padding: "2px 8px",
                        borderRadius: 4,
                        margin: "4px 0",
                        backgroundColor: zone.zone_type === "restricted" ? "#fee2e2" : "#fef3c7",
                        color
                      }}>
                        ⚠️ {zone.zone_type.toUpperCase()} ZONE
                      </div>
                      {zone.description ? <p style={{ margin: "4px 0 8px 0", fontSize: "0.85rem", color: "#334155" }}>{zone.description}</p> : null}
                      <button
                        type="button"
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          backgroundColor: "#dc2626",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "0.8rem"
                        }}
                        onClick={() => sendAlert({
                          type: "geofence",
                          severity: zone.zone_type === "restricted" ? "high" : "medium",
                          message: `Tourist hazard report in ${zone.name}`,
                          location: currentLocation,
                          status: "active"
                        })}
                      >
                        Report Hazard Here
                      </button>
                    </div>
                  </Popup>
                </Polygon>
              ));
            }) : null}
          </MapContainer>

          <div className="map-badge-hint">
            👉 Click anywhere on map to update pin location
          </div>
        </div>

        <aside className="location-card">
          <div>
            <div className="section-heading compact" style={{ marginTop: 0 }}>
              <h2>Location Info</h2>
              <span className={`pill ${currentLocation ? "success" : "info"}`}>
                {currentLocation ? "Active Pin" : "Waiting"}
              </span>
            </div>

            {currentLocation ? (
              <div className="coord-grid">
                <div className="coord-box">
                  <small>Latitude</small>
                  <b>{Number(currentLocation.latitude).toFixed(5)}</b>
                </div>
                <div className="coord-box">
                  <small>Longitude</small>
                  <b>{Number(currentLocation.longitude).toFixed(5)}</b>
                </div>
                <div className="coord-box">
                  <small>Accuracy</small>
                  <b>{Math.round(currentLocation.accuracy || 0)}m</b>
                </div>
                <div className="coord-box">
                  <small>Speed</small>
                  <b>{currentLocation.speed ? `${(currentLocation.speed * 3.6).toFixed(1)} km/h` : "0 km/h"}</b>
                </div>
              </div>
            ) : (
              <p className="empty">Click on the map or click Center to acquire coordinates.</p>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", display: "grid", gap: "10px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1rem" }}>Emergency Dispatch</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              Call <a href="tel:112" style={{ fontWeight: "bold" }}>112</a> for immediate assistance.
            </p>
            <button
              type="button"
              className="danger"
              disabled={loggingAlert}
              onClick={logRiskAlert}
              style={{ width: "100%" }}
            >
              {loggingAlert ? "Logging Alert…" : "⚠️ Log Risk Alert"}
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Safety Boundaries ({riskZones.length})</h3>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: "0.8rem", padding: "2px 6px" }}
                onClick={loadZones}
              >
                🔄 Sync
              </button>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 10px 0" }}>
              Monitored risk perimeters:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto" }}>
              {riskZones.map((zone) => {
                const centerPt = getZoneCenter(zone);
                const color = zone.zone_type === "restricted" ? "#dc2626" : zone.zone_type === "risky" ? "#d97706" : "#16a34a";
                const bg = zone.zone_type === "restricted" ? "#fef2f2" : zone.zone_type === "risky" ? "#fffbeb" : "#f0fdf4";
                const isCurrentInZone = activeZoneAlert?._id === zone._id;
                return (
                  <div
                    key={zone._id || zone.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: bg,
                      border: isCurrentInZone ? `2px solid ${color}` : `1px solid ${color}40`,
                      borderRadius: "8px"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "0.88rem", color }}>
                        {zone.name}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{zone.zone_type}</span>
                        {isCurrentInZone ? <b style={{ color: "#dc2626", marginLeft: "6px" }}>📍 You are here</b> : null}
                      </div>
                    </div>
                    {centerPt ? (
                      <button
                        type="button"
                        style={{
                          padding: "4px 8px",
                          fontSize: "0.75rem",
                          background: color,
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          whiteSpace: "nowrap"
                        }}
                        onClick={() => {
                          setViewState({ center: centerPt, zoom: 16 });
                          setMessage(`Map focused on ${zone.name} (${zone.zone_type} zone).`);
                        }}
                      >
                        🔍 Zoom
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {!riskZones.length && (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>No active safety boundaries configured yet.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
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

  const getCoordinates = async () => {
    if (currentLocation && currentLocation.latitude != null && currentLocation.longitude != null) {
      return currentLocation;
    }
    if (navigator.geolocation) {
      try {
        const position = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 }));
        const next = { latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)), accuracy: position.coords.accuracy, timestamp: new Date().toISOString() };
        setCurrentLocation(next);
        return next;
      } catch (_) {}
    }
    const fallback = { latitude: 28.6129, longitude: 77.2295, accuracy: 20, timestamp: new Date().toISOString() };
    setCurrentLocation(fallback);
    return fallback;
  };

  const start = () => {
    setSent(false);
    setError(""); setConfirmation("");
    setCountdown(3);
    timerRef.current = setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          clearInterval(timerRef.current);
          setSending(true);
          getCoordinates().then(async (loc) => {
            try {
              const incident = await sendAlert({
                type: "sos",
                severity: "high",
                status: "active",
                message: "Emergency SOS activated - assistance requested.",
                location: loc
              });
              setSent(true);
              setConfirmation(`Incident ${incident.incidentRef} submitted with location (${loc.latitude}, ${loc.longitude}). Status: ${incident.status}.`);
            } catch (err) {
              setError(err.message || "SOS could not be saved. Call 112 if you need immediate help.");
            } finally {
              setSending(false);
            }
          });
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
      <p className="eyebrow">EMERGENCY ALERT</p>
      <h1>Request Immediate Help</h1>
      <p>When activated, your high-priority emergency alert with coordinates is sent to authorities and response console.</p>
      {currentLocation ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "8px 12px", borderRadius: 8, margin: "12px 0", fontSize: "0.95rem" }}>
          📍 <b>Target Emergency Location:</b> Lat {Number(currentLocation.latitude).toFixed(6)}, Lng {Number(currentLocation.longitude).toFixed(6)}
        </div>
      ) : (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "8px 12px", borderRadius: 8, margin: "12px 0", fontSize: "0.95rem" }}>
          📍 <b>Location Status:</b> Will acquire device coordinates or map pin when triggered.
        </div>
      )}
      {confirmation ? <p className="notice">{confirmation} <Link to="../incidents">View incident updates</Link></p> : null}
      {error ? <p className="notice danger-note">{error} <a href="tel:112">Call 112</a>.</p> : null}
      {countdown ? (
        <div className="countdown-card">
          <b>{countdown}</b>
          <span>Sending SOS in...</span>
          <button className="secondary" onClick={cancel}>Cancel</button>
        </div>
      ) : (
        <button className="sos-button" disabled={sending} onClick={start}>
          {sending ? "SENDING…" : sent ? "SEND AGAIN" : "SEND SOS"}
        </button>
      )}
      <p><a className="secondary" href="tel:112">Call emergency services: 112</a></p>
      <div className="grid two">
        <article className="card">
          <h2>What Happens</h2>
          <p>Your coordinates, profile, and high-priority emergency alert are prepared for operators and police responders.</p>
        </article>
        <article className="card">
          <h2>Important Notes</h2>
          <p>Use SOS for genuine emergencies. You can click on the Map page to pin your exact location if GPS is unavailable.</p>
        </article>
      </div>
    </div>
  );
}

const PUBLIC_TUNNEL_URL = process.env.REACT_APP_PUBLIC_TUNNEL_URL || "https://spray-zshops-foster-phones.trycloudflare.com";

function DigitalId({ user }) {
  const safeId = user?.digitalId || (user?._id || user?.id ? `DIG-${String(user._id || user.id).slice(-8).toUpperCase()}` : "DIG-VERIFIED");
  const isLocal = typeof window !== "undefined" && ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
  const publicVerifyUrl = isLocal
    ? `${PUBLIC_TUNNEL_URL}/verify/${encodeURIComponent(safeId)}`
    : `${window.location.origin}/verify/${encodeURIComponent(safeId)}`;
  const localVerifyUrl = `/verify/${encodeURIComponent(safeId)}`;

  return (
    <section className="card digital-id-page">
      <p className="eyebrow">VERIFIABLE TOURIST CREDENTIAL</p>
      <h1>My Digital ID</h1>
      <div className="id-card-print">
        <div>
          <p>RakshaSetu · Tourist Safety ID</p>
          <h2>{user?.name || "Tourist"}</h2>
          <code className="digital-id">{safeId}</code>
          <p>
            Status: <b style={{ color: user?.accountStatus === "active" ? "#10b981" : "#eab308" }}>{user?.accountStatus || "active"}</b>
          </p>
          <p>
            Emergency contact:{" "}
            {user?.emergencyContacts?.[0]?.name
              ? `${user.emergencyContacts[0].name} (${user.emergencyContacts[0].phone || ""})`
              : "112 (National Emergency)"}
          </p>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            <a
              href={publicVerifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-button"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0284c7", fontWeight: 700 }}
            >
              ✓ Test Official Verification Pass
            </a>
            <Link
              to={localVerifyUrl}
              style={{ fontSize: 12, color: "#64748b", textDecoration: "underline" }}
            >
              View on Local Web Portal
            </Link>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <a
            href={publicVerifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Scan with phone or click to verify online"
            style={{
              display: "inline-block",
              background: "#ffffff",
              padding: 10,
              borderRadius: 14,
              border: "1.5px solid #cbd5e1",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            <QRCodeSVG
              value={publicVerifyUrl}
              size={156}
              level="H"
              includeMargin={true}
            />
          </a>
          <span style={{ color: "#10b981", fontSize: 11, fontWeight: 800 }}>
            ● Instant Live Mobile Scan Enabled
          </span>
          <small style={{ color: "#64748b", fontSize: 10, textAlign: "center", maxWidth: 170 }}>
            Scan with any smartphone camera to open verified credentials
          </small>
        </div>
      </div>
      <p className="muted">
        The QR code opens the official national safety verification portal on any smartphone. It confirms your active safety registration without revealing your phone, private contacts, or live coordinates.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button className="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <a
          href={publicVerifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ops-button subtle"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          Open Public Verification Page
        </a>
      </div>
    </section>
  );
  
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
  return <><p className="eyebrow">TRAVEL SAFELY</p><h1>Safety information & help</h1><div className="grid two"><section className="card"><h2>Emergency support</h2><p>For immediate danger in India, call <a href="tel:112">112</a>. This website records an alert for authorized system operators; it does not automatically contact police or guarantee emergency response.</p><p>Tell your emergency contact where you are and follow instructions from local emergency services.</p></section><section className="card"><h2>Location and privacy</h2><p>Browser location is shared only after you opt in. Your browser can pause GPS updates when a tab is closed, suspended, offline, or denied permission.</p><p>Responders can view your location only when both Location Sharing and Share with Police are enabled. QR verification reveals only the public ID validity fields.</p></section><section className="card"><h2>Travel checklist</h2><ul><li>Keep emergency contacts current.</li><li>Share your trip plan with someone you trust.</li><li>Check your device charge and connectivity.</li><li>Use SOS only for a genuine emergency.</li></ul></section><section className="card"><h2>Common questions</h2><details><summary>Does SOS call emergency services?</summary><p>No. It records an incident for system operators. Call 112 directly when immediate assistance is needed.</p></details><details><summary>Can tracking run with my browser closed?</summary><p>No. This web application cannot guarantee background tracking outside an active browser session.</p></details><details><summary>How do I stop sharing?</summary><p>Turn off Location Sharing or Share with Police under Profile & Privacy. The server then removes your profile from the monitoring map.</p></details></section></div><section className="card"><h2>Contact support</h2><p>Messages are stored in your MongoDB account and reviewed by a monitoring officer. Do not use this form for emergencies.</p>{notice ? <p className="notice">{notice}</p> : null}{error ? <p className="notice danger-note">{error}</p> : null}<form className="support-form" onSubmit={submit}><label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="account">Account access</option><option value="privacy">Privacy and data</option><option value="technical">Technical issue</option><option value="other">Other</option></select></label><label>Subject<input required minLength="3" maxLength="160" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /></label><label>Message<textarea required minLength="10" maxLength="3000" value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} /></label><button className="primary" disabled={busy}>{busy ? "Sending…" : "Submit support request"}</button></form>{supportRequests.length ? <div><h3>Your support requests</h3>{supportRequests.map((item) => <article className="support-request-row" key={item._id}><b>{item.subject}</b><span>{(item?.status || "open").replace(/_/g, " ")} · {new Date(item.createdAt).toLocaleString()}</span>{item.response ? <p>Response: {item.response}</p> : null}</article>)}</div> : <p className="empty">No support requests yet.</p>}</section><section><div className="section-heading"><h2>Official safety announcements</h2><span>Live updates from system administrators</span></div>{announcements.length ? announcements.map((item) => <article className="card" key={item._id}><span className={`pill ${item.severity === "urgent" ? "danger" : item.severity === "warning" ? "warning" : "info"}`}>{item.severity}</span><h3>{item.title}</h3><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></article>) : <p className="empty">No current announcements.</p>}</section></>;
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
  const navItems = useMemo(() => [["", "Home"], ["assistant", "🤖 Raksha AI"], ["id", "Digital ID"], ["trips", "Trips"], ["incidents", "Incidents"], ["alerts", "Alerts"], ["map", "Map"], ["safety", "Safety & Help"], ["profile", "Profile"]], []);
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
    if (!user) return;
    if (navigator.geolocation && !currentLocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy || 10),
            speed: pos.coords.speed,
            timestamp: new Date().toISOString()
          };
          setCurrentLocation(loc);
          nodeApi.post("/locations", loc).catch(() => {});
        },
        (err) => {
          console.warn("Auto-detect GPS deferred:", err.message);
          setCurrentLocation((prev) => prev || {
            latitude: 28.6129,
            longitude: 77.2295,
            accuracy: 25,
            timestamp: new Date().toISOString()
          });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [user, currentLocation]);

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
        const loc = alert.location || currentLocation || { latitude: 28.6129, longitude: 77.2295, accuracy: 25 };
        const { data } = await nodeApi.post("/incidents/sos", { message: alert.message, location: loc });
        setIncidents((items) => [data, ...items.filter((item) => item._id !== data._id)]);
        return data;
      }
      const loc = alert.location || currentLocation;
      const geoLocation = alert.geoLocation || (loc && loc.latitude != null && loc.longitude != null ? { type: "Point", coordinates: [Number(loc.longitude), Number(loc.latitude)] } : undefined);
      const { data } = await nodeApi.post("/alerts", { type: alert.type, severity: alert.severity, message: alert.message, geoLocation });
      setAlerts((items) => [data, ...items.filter((item) => item._id !== data._id)]);
      load().catch(() => {});
      return data;
    } catch (err) {
      console.error("Alert save error:", err);
      throw new Error(err.response?.data?.error || "Alert could not be saved. Call 112 if you need immediate help.");
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
          <Route path="assistant" element={<TouristAiAssistant user={user} currentLocation={currentLocation} sendAlert={sendAlert} />} />
          <Route path="trips" element={<Trips trips={trips} load={load} />} />
          <Route path="id" element={<DigitalId user={user} />} />
          <Route path="incidents" element={<TouristIncidents incidents={incidents} onCancel={cancelIncident} />} />
          <Route path="alerts" element={<Alerts alerts={alerts} sendAlert={sendAlert} currentLocation={currentLocation} />} />
          <Route path="map" element={<TouristMap user={user} trips={trips} load={load} currentLocation={currentLocation} setCurrentLocation={setCurrentLocation} sendAlert={sendAlert} />} />
          <Route path="sos" element={<SOS sendAlert={sendAlert} currentLocation={currentLocation} setCurrentLocation={setCurrentLocation} user={user} />} />
          <Route path="safety" element={<SafetyInformation announcements={announcements} supportRequests={supportRequests} onSendSupport={sendSupport} />} />
          <Route path="profile" element={<Profile user={user} setUser={setUser} signOut={signOut} />} />
          <Route path="*" element={<Navigate to="/tourist" replace />} />
        </Routes>
      </main>
      <Link
        className="ai-float"
        to="assistant"
        style={{
          position: "fixed",
          bottom: "94px",
          right: "24px",
          backgroundColor: "#0284c7",
          color: "#ffffff",
          padding: "10px 18px",
          borderRadius: "30px",
          fontWeight: "700",
          fontSize: "13px",
          textDecoration: "none",
          boxShadow: "0 4px 16px rgba(2, 132, 199, 0.45)",
          zIndex: 998,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
        }}
      >
        <span>🤖</span> Ask AI
      </Link>
      <Link className="sos-float" to="sos">SOS</Link>
    </div>
  );
}

