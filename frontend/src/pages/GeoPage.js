import React, { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { MapContainer, TileLayer, Circle, Polygon, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "../services/api";
import L from "leaflet";

export default function GeoPage() {
  const center = useMemo(() => [26.2, 92.9], []);
  const [zones, setZones] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    apiClient.geoApi
      .get("/zones/geo", { params: { limit: 200 } })
      .then((r) => {
        if (!isMounted) return;
        const list = Array.isArray(r.data?.zones) ? r.data.zones : [];
        setZones(list);
        // Fit bounds to all zones
        try {
          const points = [];
          list.forEach((z) => {
            try {
              const gj = JSON.parse(z.geometry);
              if (gj.type === "Polygon") {
                gj.coordinates[0].forEach(([lng, lat]) => points.push([lat, lng]));
              } else if (gj.type === "MultiPolygon") {
                gj.coordinates.forEach((poly) => poly[0].forEach(([lng, lat]) => points.push([lat, lng])));
              }
            } catch (_) {}
          });
          if (points.length && mapRef.current) {
            const bounds = L.latLngBounds(points);
            mapRef.current.fitBounds(bounds.pad(0.1));
          }
        } catch (_) {}
      })
      .catch(() => setZones([]));
    return () => { isMounted = false; };
  }, []);
  return (
    <AdminLayout>
      <div className="grid">
        <div className="panel">
          <div className="panel-header">Tourist Density Map</div>
          <div className="panel-body" style={{ height: 520 }}>
            <MapContainer center={center} zoom={7} style={{ height: "100%", width: "100%" }} whenCreated={(m)=>{ mapRef.current = m; }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {zones.map((z) => {
                try {
                  const gj = JSON.parse(z.geometry);
                  // Expecting Polygon coordinates [[[lng,lat],...]]
                  const polys = [];
                  if (gj.type === "Polygon") {
                    polys.push(gj.coordinates[0].map(([lng, lat]) => [lat, lng]));
                  } else if (gj.type === "MultiPolygon") {
                    gj.coordinates.forEach((poly) => {
                      if (poly && poly[0]) polys.push(poly[0].map(([lng, lat]) => [lat, lng]));
                    });
                  }
                  const color = z.zone_type === "restricted" ? "#ef4444" : (z.zone_type === "risky" ? "#f59e0b" : "#22c55e");
                  return polys.map((coords, idx) => (
                    <Polygon key={`${z.id}-${idx}`} positions={coords} pathOptions={{ color, weight: 3, fillColor: color, fillOpacity: 0.35 }}>
                      <Popup>
                        <div style={{ minWidth: 180 }}>
                          <div style={{ fontWeight: 700 }}>{z.name}</div>
                          <div style={{ textTransform: "capitalize" }}>{z.zone_type}</div>
                          <div>{z.description}</div>
                        </div>
                      </Popup>
                    </Polygon>
                  ));
                } catch (_) {
                  return null;
                }
              })}
            </MapContainer>
            <p style={{ marginTop: 12 }}>Only geofences returned by the configured service are shown.</p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">Create Geofence</div>
          <div className="panel-body">
            <GeofenceForm onCreated={() => {
              apiClient.geoApi
                .get("/zones/geo", { params: { limit: 200 } })
                .then((r) => setZones(Array.isArray(r.data?.zones) ? r.data.zones : []))
                .catch(() => {});
            }} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}


function GeofenceForm({ onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [zoneType, setZoneType] = useState("restricted");
  const [wkt, setWkt] = useState("POLYGON((92.899 26.199, 92.903 26.199, 92.903 26.203, 92.899 26.203, 92.899 26.199))");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = () => {
    setMsg("");
    if (!name.trim() || !wkt.trim()) {
      setMsg("Name and WKT are required");
      return;
    }
    setSaving(true);
    apiClient.geoApi.post("/zones", {
      name,
      description,
      zone_type: zoneType,
      wkt_polygon: wkt,
      is_active: true
    }).then(() => {
      setMsg("Created successfully");
      setName("");
      setDescription("");
      setZoneType("restricted");
      if (typeof onCreated === "function") onCreated();
    }).catch((e) => {
      setMsg("Failed to create zone");
    }).finally(() => setSaving(false));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {msg && <div style={{ color: "#e5e7eb" }}>{msg}</div>}
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ background: "#ffffff", color: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
      />
      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ background: "#ffffff", color: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
      />
      <select
        value={zoneType}
        onChange={(e) => setZoneType(e.target.value)}
        style={{ background: "#ffffff", color: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
      >
        <option value="safe">safe</option>
        <option value="risky">risky</option>
        <option value="restricted">restricted</option>
      </select>
      <textarea
        rows={6}
        placeholder="WKT POLYGON((lng lat, ...))"
        value={wkt}
        onChange={(e) => setWkt(e.target.value)}
        style={{ background: "#ffffff", color: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: 8, resize: "vertical" }}
      />
      <button className="btn" onClick={submit} disabled={saving}>
        {saving ? "Creating..." : "Create Zone"}
      </button>
    </div>
  );
}

