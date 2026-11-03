import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIconPng from "../marker-icon.png";
import { nodeApi } from "../services/api";
import { connectRealtime } from "../services/realtime";

const sosIcon = new L.Icon({
  iconUrl: markerIconPng,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28],
});

const geoObject = (geometry) => {
  if (!geometry) return null;
  if (typeof geometry === "object") return geometry;
  try {
    return JSON.parse(geometry);
  } catch {
    return null;
  }
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

export default function MapView({ center = [28.6139, 77.209], markers = [], showZones = true }) {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    if (!showZones) return;

    const loadZones = () => {
      nodeApi
        .get("/zones", { params: { only_active: true } })
        .then(({ data }) => {
          const raw = Array.isArray(data?.zones) ? data.zones : [];
          setZones(raw.filter((z) => z && z.is_active !== false));
        })
        .catch(() => {});
    };

    loadZones();

    // Subscribe to realtime geofence changes so map polygons and icons update instantly
    const socket = connectRealtime();

    const handleDeactivate = (removedZone) => {
      const removedId = String(removedZone?._id || removedZone?.id || "");
      if (!removedId) return;
      setZones((prev) => (prev || []).filter((z) => String(z?._id || z?.id) !== removedId));
    };

    socket.on("geofence:deactivated", handleDeactivate);
    socket.on("geofence:deleted", handleDeactivate);
    socket.on("zone:deleted", handleDeactivate);
    socket.on("geofence:created", loadZones);
    socket.on("zone:created", loadZones);
    socket.on("geofence:updated", loadZones);

    return () => socket.disconnect();
  }, [showZones]);

  return (
    <MapContainer center={center} zoom={11} style={{ height: "500px", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {showZones &&
        zones.flatMap((zone) => {
          const color = zone.zone_type === "restricted" ? "#dc2626" : zone.zone_type === "risky" ? "#ea580c" : "#16a34a";
          return ringsFor(zone).map((ring, index) => (
            <Polygon
              key={`${zone._id || zone.id}-${index}`}
              positions={ring}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.25,
                weight: 3,
                dashArray: zone.zone_type === "restricted" ? "6, 6" : undefined,
              }}
            >
              <Popup>
                <b>{zone.name}</b>
                <br />
                <span style={{ color, fontWeight: "bold", textTransform: "capitalize" }}>{zone.zone_type} Zone</span>
                <br />
                {zone.description}
              </Popup>
            </Polygon>
          ));
        })}
      {markers.map((m) => {
        // Exclude markers that are resolved
        if (m.is_resolved === true || m.status === "resolved") return null;

        // If marker is tied to a geofenceZone that has been removed/deactivated, do not show it
        if (m.geofenceZone) {
          const zoneId = String(m.geofenceZone?._id || m.geofenceZone);
          const isZoneActive = zones.some((z) => String(z?._id || z?.id) === zoneId);
          if (!isZoneActive) return null;
        }

        // Handle different data structures for coordinates
        let lat = null;
        let lng = null;

        if (m.location?.latitude != null && m.location?.longitude != null) {
          lat = Number(m.location.latitude);
          lng = Number(m.location.longitude);
        } else if (m.latitude != null && m.longitude != null) {
          lat = Number(m.latitude);
          lng = Number(m.longitude);
        } else if (
          Array.isArray(m.geoLocation?.coordinates) &&
          m.geoLocation.coordinates.length >= 2 &&
          (m.geoLocation.coordinates[0] !== 0 || m.geoLocation.coordinates[1] !== 0)
        ) {
          lng = Number(m.geoLocation.coordinates[0]);
          lat = Number(m.geoLocation.coordinates[1]);
        } else if (m.geoLocation?.lat != null && m.geoLocation?.lng != null) {
          lat = Number(m.geoLocation.lat);
          lng = Number(m.geoLocation.lng);
        }

        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
          return null;
        }

        return (
          <Marker
            key={m._id || m.id || `${lat}-${lng}-${m.type}`}
            position={[lat, lng]}
            icon={sosIcon}
          >
            <Popup>
              <div>
                <strong style={{ color: m.severity === "high" || m.type === "sos" ? "#dc2626" : "#0f766e" }}>
                  {m.type ? m.type.toUpperCase() : "ALERT"}
                </strong>
                <br />
                {m.message || m.description || "No description"}
                <br />
                <span style={{ color: "#0f766e", fontWeight: "bold" }}>
                  📍 {lat.toFixed(6)}, {lng.toFixed(6)}
                </span>
                <br />
                <small>Severity: {m.severity || "Unknown"}</small>
                {m.link ? (
                  <>
                    <br />
                    <a href={m.link}>Open related incident</a>
                  </>
                ) : null}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
