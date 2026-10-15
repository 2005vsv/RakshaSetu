const validPoint = (point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])) && Math.abs(Number(point[0])) <= 180 && Math.abs(Number(point[1])) <= 90;

const pointInRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    const crosses = ((yi > point[1]) !== (yj > point[1])) && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
};

const polygonContains = (point, rings) => Array.isArray(rings) && rings.length > 0 && pointInRing(point, rings[0]) && !rings.slice(1).some((hole) => pointInRing(point, hole));
const contains = (point, geometry) => {
  if (!geometry || !validPoint(point)) return false;
  if (geometry.type === "Polygon") return polygonContains(point, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((polygon) => polygonContains(point, polygon));
  return false;
};
const validateGeometry = (geometry) => {
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return Array.isArray(polygons) && polygons.length > 0 && polygons.every((rings) => Array.isArray(rings) && rings.length > 0 && rings.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.length <= 5000 && ring.every(validPoint) && JSON.stringify(ring[0]) === JSON.stringify(ring[ring.length - 1])));
};
const parseWkt = (wkt) => {
  const match = /^POLYGON\s*\(\(([^()]+)\)\)$/i.exec(String(wkt || "").trim());
  if (!match) return null;
  const ring = match[1].split(",").map((pair) => pair.trim().split(/\s+/).map(Number));
  const geometry = { type: "Polygon", coordinates: [ring] };
  return validateGeometry(geometry) ? geometry : null;
};

module.exports = { contains, validateGeometry, parseWkt };
