// Driving / cycling / walking times via the hosted openrouteservice API
// (replacing the self-hosted ORS). One matrix request per profile covers every
// candidate location x destination pair, instead of one request per pair.
import { haversine, type LatLon } from './geo';

export const ORS_PROFILES = ['driving-car', 'cycling-regular', 'foot-walking'] as const;
export type OrsProfile = typeof ORS_PROFILES[number];

const ORS_BASE = 'https://api.openrouteservice.org/v2';

// Used when ORS is not configured or fails: straight-line distance x detour / typical urban speed.
const FALLBACK_KMH: Record<OrsProfile, number> = { 'driving-car': 30, 'cycling-regular': 15, 'foot-walking': 4.8 };
const DETOUR = 1.3;

export function estimateMinutes(a: LatLon, b: LatLon, profile: OrsProfile): number {
  const km = (haversine(a.lat, a.lon, b.lat, b.lon) / 1000) * DETOUR;
  return (km / FALLBACK_KMH[profile]) * 60;
}

export type Matrix = { minutes: Array<Array<number | null>>; estimated: boolean };

/** Travel time in minutes from every origin to every destination. */
export async function travelMatrix(env: Env, profile: OrsProfile, origins: LatLon[], destinations: LatLon[]): Promise<Matrix> {
  const estimate = (): Matrix => ({
    minutes: origins.map(o => destinations.map(d => estimateMinutes(o, d, profile))),
    estimated: true,
  });
  if (!env.ORS_API_KEY || !origins.length || !destinations.length) return estimate();

  try {
    const locations = [...origins, ...destinations].map(p => [p.lon, p.lat]);
    const res = await fetch(`${ORS_BASE}/matrix/${profile}`, {
      method: 'POST',
      headers: { Authorization: env.ORS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations,
        sources: origins.map((_, i) => i),
        destinations: destinations.map((_, i) => origins.length + i),
        metrics: ['duration'],
      }),
    });
    if (!res.ok) throw new Error(`ORS matrix ${profile} returned ${res.status}: ${await res.text()}`);
    const body = await res.json() as { durations: Array<Array<number | null>> };
    return { minutes: body.durations.map(row => row.map(s => (s === null ? null : s / 60))), estimated: false };
  } catch (err) {
    console.error(err);
    return estimate();
  }
}

/** Route geometry as GeoJSON (same format the self-hosted ORS returned to the map). */
export async function directions(env: Env, profile: OrsProfile, start: LatLon, end: LatLon): Promise<Response> {
  if (!env.ORS_API_KEY) {
    return Response.json({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { estimated: true, segments: [{ duration: estimateMinutes(start, end, profile) * 60 }] },
        geometry: { type: 'LineString', coordinates: [[start.lon, start.lat], [end.lon, end.lat]] },
      }],
    });
  }
  const url = `${ORS_BASE}/directions/${profile}?start=${start.lon},${start.lat}&end=${end.lon},${end.lat}`;
  const res = await fetch(url, { headers: { Authorization: env.ORS_API_KEY, Accept: 'application/geo+json' } });
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
