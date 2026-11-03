// Public transport, computed from the bundled GTFS feed (see scripts/build-transit.mjs).
// Replaces both the pandas GTFS service and the self-hosted OpenTripPlanner.
import data from './data/transit.json';
import { haversine, type LatLon } from './geo';

type Stop = { lat: number; lon: number; routes: number[] };

const stops: Stop[] = (data.stops as number[][]).map(([lat, lon, ...routes]) => ({ lat, lon, routes }));
const clusters = data.clusters as number[][];
const N = clusters.length;
const matrix = Uint8Array.from(atob(data.matrix), c => c.charCodeAt(0));

const WALK_M_PER_MIN = 80;
const WALK_DETOUR = 1.3;
const MAX_WALK_TO_STOP_M = 1000;

export const walkingMinutes = (metres: number) => (metres * WALK_DETOUR) / WALK_M_PER_MIN;

export const transitInfo = { referenceDate: data.referenceDate, departures: data.departures };

/** Nearest stop within maxDistance metres. */
function nearestStop(lat: number, lon: number, maxDistance: number) {
  let best: { stop: Stop; distance: number } | null = null;
  for (const stop of stops) {
    const d = haversine(lat, lon, stop.lat, stop.lon);
    if (d <= maxDistance && (!best || d < best.distance)) best = { stop, distance: d };
  }
  return best;
}

/** Bus routes serving the nearest stop (same rules as the original GTFS service). */
export function getRouteAccessibility(lat: number, lon: number, maxDistance = 500) {
  const near = nearestStop(lat, lon, maxDistance);
  if (!near) return [];
  return near.stop.routes.map(i => {
    const r = data.routes[i];
    return { route_id: r.id, name: r.name, ref: r.ref, distance: near.distance };
  });
}

/** Transit accessibility score 0-100: 70 for number of routes, 30 for stop distance. */
export function calculateTransitScore(lat: number, lon: number, maxDistance = 500) {
  const routes = getRouteAccessibility(lat, lon, maxDistance);
  if (!routes.length) return 0;
  const routeScore = Math.min(routes.length * 10, 70);
  const distanceScore = Math.max(30 * (1 - routes[0].distance / maxDistance), 0);
  return Math.round((routeScore + distanceScore) * 10) / 10;
}

function clustersNear(pt: LatLon) {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const d = haversine(pt.lat, pt.lon, clusters[i][0], clusters[i][1]);
    if (d <= MAX_WALK_TO_STOP_M) out.push([i, walkingMinutes(d)]);
  }
  return out;
}

/**
 * Door-to-door bus journey time in minutes (walk + average wait + ride + walk),
 * for a weekday morning departure. Like OTP's TRANSIT,WALK plan, walking the whole
 * way wins if it is quicker. Returns null if no bus journey is possible.
 */
export function busMinutes(origin: LatLon, destination: LatLon): number | null {
  return busMinutesMany([origin], destination)[0];
}

/** Same as busMinutes for many origins to one destination (shares the destination search). */
export function busMinutesMany(origins: LatLon[], destination: LatLon): Array<number | null> {
  const ends = clustersNear(destination);
  return origins.map(origin => {
    let best = Infinity;
    for (const [a, walkA] of clustersNear(origin)) {
      for (const [b, walkB] of ends) {
        if (a === b) continue;
        const ride = matrix[a * N + b];
        if (ride !== 255) best = Math.min(best, walkA + ride + walkB);
      }
    }
    if (best === Infinity) return null;
    const direct = walkingMinutes(haversine(origin.lat, origin.lon, destination.lat, destination.lon));
    return Math.min(best, direct);
  });
}
