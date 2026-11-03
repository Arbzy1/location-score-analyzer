export type LatLon = { lat: number; lon: number };
type Ring = number[][]; // [lon, lat][]
export type Polygonal =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

/** Great-circle distance in metres. */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inPolygon(lon: number, lat: number, geom: Polygonal): boolean {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polys.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some(h => inRing(lon, lat, h)));
}

/** Uniform random points inside the polygon (rejection sampling within its bbox). */
export function randomPointsIn(geom: Polygonal, bbox: [number, number, number, number], count: number): LatLon[] {
  const [minLat, maxLat, minLon, maxLon] = bbox;
  const points: LatLon[] = [];
  for (let attempts = 0; points.length < count && attempts < count * 50; attempts++) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lon = minLon + Math.random() * (maxLon - minLon);
    if (inPolygon(lon, lat, geom)) points.push({ lat, lon });
  }
  return points;
}

/** Nearest item to a point, with its distance in metres. */
export function nearest<T extends LatLon>(pt: LatLon, items: T[]): { item: T; distance: number } | null {
  let best: { item: T; distance: number } | null = null;
  for (const item of items) {
    const d = haversine(pt.lat, pt.lon, item.lat, item.lon);
    if (!best || d < best.distance) best = { item, distance: d };
  }
  return best;
}
