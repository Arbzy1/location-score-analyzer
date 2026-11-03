// OpenStreetMap lookups that osmnx used to do: city boundary (Nominatim) and
// amenities / place names (Overpass). All results are cached in Neon.
import { cached } from './db';
import type { LatLon, Polygonal } from './geo';
import topSecondary from '../../server/data/top_schools.json';
import topPrimary from '../../server/data/top_primary_schools.json';

export type TopSchool = { rating: string; rank: number; postcode: string };
export const topSecondarySchools = topSecondary as Record<string, TopSchool>;
export const topPrimarySchools = topPrimary as Record<string, TopSchool>;
export const allTopSchools: Record<string, TopSchool> = { ...topSecondarySchools, ...topPrimarySchools };

export type SchoolType = 'primary' | 'secondary' | 'unknown';
export type Feature = LatLon & { name: string; schoolType?: SchoolType };
export type Amenities = { school: Feature[]; hospital: Feature[]; supermarket: Feature[]; places: Feature[] };
export type City = { name: string; osmType: string; osmId: number; bbox: [number, number, number, number]; geometry: Polygonal };

const DAY = 86400;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const userAgent = (env: Env) => `LocationScoreAnalyzer/2.0 (+${env.CONTACT})`;

/** City boundary polygon, like osmnx.geocode_to_gdf. */
export function geocodeCity(env: Env, ctx: ExecutionContext, query: string): Promise<City | null> {
  const key = `city:v1:${query.trim().toLowerCase()}`;
  return cached(env, ctx, key, 30 * DAY, async () => {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      q: query, format: 'jsonv2', polygon_geojson: '1', polygon_threshold: '0.0005', limit: '5',
    }).toString();
    const res = await fetch(url, { headers: { 'User-Agent': userAgent(env), 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
    const results = await res.json() as any[];
    const hit = results.find(r => r.geojson?.type === 'Polygon' || r.geojson?.type === 'MultiPolygon');
    if (!hit) return null;
    return {
      name: hit.display_name,
      osmType: hit.osm_type,
      osmId: Number(hit.osm_id),
      bbox: hit.boundingbox.map(Number) as [number, number, number, number], // minLat, maxLat, minLon, maxLon
      geometry: hit.geojson,
    };
  });
}

async function overpass(env: Env, query: string): Promise<any[]> {
  // Some mirrors refuse Cloudflare's IPs or are slow, so ask them all at once and take
  // the first good answer. Results are cached, so this happens rarely per city.
  const controller = new AbortController();
  const timeout = AbortSignal.timeout(50000);
  const signal = AbortSignal.any([controller.signal, timeout]);
  try {
    return await Promise.any(OVERPASS_ENDPOINTS.map(async endpoint => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'User-Agent': userAgent(env), 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }),
          signal,
        });
        if (!res.ok) throw new Error(`returned ${res.status}`);
        const json = await res.json() as { elements?: any[]; remark?: string };
        // Overpass reports query timeouts as a 200 with a "remark" and partial data
        if (json.remark?.includes('error')) throw new Error(json.remark);
        return json.elements || [];
      } catch (err) {
        if (!controller.signal.aborted) console.warn('Overpass endpoint failed', endpoint, String(err));
        throw err;
      }
    }));
  } catch {
    throw new Error('All Overpass endpoints failed');
  } finally {
    controller.abort(); // cancel the slower requests
  }
}

function toAmenities(elements: any[]): Amenities {
  const out: Amenities = { school: [], hospital: [], supermarket: [], places: [] };
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    const tags = el.tags || {};
    if (lat === undefined || lon === undefined) continue;
    const base = { lat, lon, name: tags.name || 'Unnamed' };
    if (tags.amenity === 'school') out.school.push({ ...base, schoolType: getSchoolType(tags.name, tags['isced:level']) });
    else if (tags.amenity === 'hospital') out.hospital.push(base);
    else if (tags.shop === 'supermarket') out.supermarket.push(base);
    else if (tags.place && tags.name) out.places.push(base);
  }
  return out;
}

const AMENITY_FILTERS = (scope: string) => `
  nwr["amenity"="school"]${scope};
  nwr["amenity"="hospital"]${scope};
  nwr["shop"="supermarket"]${scope};
  node["place"~"^(suburb|neighbourhood|quarter|town|city|village|hamlet)$"]${scope};`;

/** Schools, hospitals, supermarkets and place names inside the city boundary. */
export function getCityAmenities(env: Env, ctx: ExecutionContext, city: City): Promise<Amenities> {
  const areaOffset = city.osmType === 'relation' ? 3600000000 : city.osmType === 'way' ? 2400000000 : null;
  const [minLat, maxLat, minLon, maxLon] = city.bbox;
  const query = areaOffset !== null
    ? `[out:json][timeout:60];area(id:${areaOffset + city.osmId})->.a;(${AMENITY_FILTERS('(area.a)')});out tags center;`
    : `[out:json][timeout:60];(${AMENITY_FILTERS(`(${minLat},${minLon},${maxLat},${maxLon})`)});out tags center;`;
  return cached(env, ctx, `amenities:v1:${city.osmType}:${city.osmId}`, 14 * DAY, async () => toAmenities(await overpass(env, query)));
}

/** Amenities within radius metres of a point (used for saved postcodes). */
export function getAmenitiesAround(env: Env, ctx: ExecutionContext, pt: LatLon, radius = 3000): Promise<Amenities> {
  const lat = pt.lat.toFixed(4), lon = pt.lon.toFixed(4);
  const query = `[out:json][timeout:60];(${AMENITY_FILTERS(`(around:${radius},${lat},${lon})`)});out tags center;`;
  return cached(env, ctx, `amenities-around:v1:${lat},${lon},${radius}`, 14 * DAY, async () => toAmenities(await overpass(env, query)));
}

/** UK postcode lookup via postcodes.io, returning its raw response body. */
export function lookupPostcode(env: Env, ctx: ExecutionContext, postcode: string): Promise<{ status: number; result?: any; error?: string }> {
  const clean = postcode.replace(/\s+/g, '').toUpperCase();
  return cached(env, ctx, `postcode:v1:${clean}`, 90 * DAY, async () => {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
    const body = await res.json() as { status: number; result?: any; error?: string };
    // Cache "not found" too, but let server errors propagate (and not be cached)
    if (res.status >= 500) throw new Error(`postcodes.io returned ${res.status}`);
    return body;
  });
}

export async function postcodeToLatLon(env: Env, ctx: ExecutionContext, postcode: string): Promise<LatLon | null> {
  const data = await lookupPostcode(env, ctx, postcode);
  if (data.status !== 200 || !data.result) return null;
  return { lat: Number(data.result.latitude), lon: Number(data.result.longitude) };
}

const PRIMARY_WORDS = ['primary', 'junior', 'infant', 'elementary', 'gynradd', 'babanod'];
const SECONDARY_WORDS = ['secondary', 'high', 'comprehensive', 'academy', 'college', 'gyfun', 'uwchradd'];

/** Primary/secondary from the top-school lists, then OSM isced:level, then the name. */
export function getSchoolType(name: string | undefined, isced?: string): SchoolType {
  const n = name || '';
  if (n in topSecondarySchools) return 'secondary';
  if (n in topPrimarySchools) return 'primary';
  if (isced) {
    const levels = isced.split(/[;,\-]/).map(s => parseInt(s, 10)).filter(l => !Number.isNaN(l));
    const primary = levels.some(l => l <= 1), secondary = levels.some(l => l === 2 || l === 3);
    if (primary && !secondary) return 'primary';
    if (secondary && !primary) return 'secondary';
  }
  const lower = n.toLowerCase();
  if (PRIMARY_WORDS.some(w => lower.includes(w))) return 'primary';
  if (SECONDARY_WORDS.some(w => lower.includes(w))) return 'secondary';
  return 'unknown';
}
