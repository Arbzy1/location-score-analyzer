// Port of analyze_location() from the original Flask server. The response shape is
// unchanged so the React client keeps working.
import { nearest, randomPointsIn, type LatLon } from './geo';
import {
  allTopSchools, geocodeCity, getCityAmenities, postcodeToLatLon,
  type Amenities, type Feature, type SchoolType,
} from './osm';
import { travelMatrix, ORS_PROFILES, type OrsProfile } from './routing';
import { busMinutesMany, calculateTransitScore, getRouteAccessibility } from './transit';

type Mode = 'auto' | 'driving' | 'cycling' | 'walking' | 'bus';
type ModeKey = OrsProfile | 'bus-transit';
type TravelLocation = { postcode: string; type?: string; frequency?: number; travelMode?: Mode; lat?: number; lng?: number; lon?: number };
export type Preferences = {
  locations?: TravelLocation[];
  amenityWeights?: Record<string, number | string>;
  travelMode?: Mode;
  schoolFilter?: 'primary' | 'secondary' | 'both';
};

const NUM_CANDIDATES = 20;
const MAX_WEEKLY_MINUTES = 600;
// Distance (km) at which an amenity's score reaches zero
const AMENITY_REFERENCE_KM: Record<string, number> = { school: 2, hospital: 3, supermarket: 1 };
const MODE_TO_KEY: Record<Exclude<Mode, 'auto'>, ModeKey> = {
  driving: 'driving-car', cycling: 'cycling-regular', walking: 'foot-walking', bus: 'bus-transit',
};

const round1 = (x: number) => Math.round(x * 10) / 10;

export class AnalysisError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function analyzeLocation(env: Env, ctx: ExecutionContext, cityQuery: string, prefs: Preferences | null) {
  const warnings: string[] = [];
  const city = await geocodeCity(env, ctx, cityQuery);
  if (!city) throw new AnalysisError(`Could not find a boundary for "${cityQuery}"`, 404);

  const travelMode: Mode = prefs?.travelMode || 'auto';
  const schoolFilter = ['primary', 'secondary', 'both'].includes(prefs?.schoolFilter as string) ? prefs!.schoolFilter! : 'both';
  const amenityWeights: Record<string, number> = { school: 15, hospital: 15, supermarket: 10 };
  for (const [k, v] of Object.entries(prefs?.amenityWeights || {})) {
    const n = parseInt(String(v).replace('%', ''), 10);
    if (!Number.isNaN(n)) amenityWeights[k] = n;
  }

  const candidates = randomPointsIn(city.geometry, city.bbox, NUM_CANDIDATES);

  let amenities: Amenities;
  try {
    amenities = await getCityAmenities(env, ctx, city);
  } catch (err) {
    console.error('Amenity lookup failed', err);
    warnings.push('OpenStreetMap amenity data is temporarily unavailable, so amenity scores are missing.');
    amenities = { school: [], hospital: [], supermarket: [], places: [] };
  }
  const schools = filterSchools(amenities.school, schoolFilter);

  // ---- destinations and travel times (one batch per mode) ----
  const destinations: Array<TravelLocation & { coords: LatLon; mode: Mode }> = [];
  for (const loc of prefs?.locations || []) {
    if (!loc?.postcode) continue;
    const lon = loc.lng ?? loc.lon;
    const coords = loc.lat != null && lon != null
      ? { lat: Number(loc.lat), lon: Number(lon) }
      : await postcodeToLatLon(env, ctx, loc.postcode);
    if (!coords) { warnings.push(`Could not find postcode ${loc.postcode}`); continue; }
    // A global travel mode overrides each destination's own mode
    const mode = travelMode !== 'auto' ? travelMode : (loc.travelMode || 'auto');
    destinations.push({ ...loc, coords, mode });
  }

  const times = {} as Record<ModeKey, Array<Array<number | null>>>;
  if (destinations.length) {
    const destCoords = destinations.map(d => d.coords);
    const matrices = await Promise.all(ORS_PROFILES.map(p => travelMatrix(env, p, candidates, destCoords)));
    ORS_PROFILES.forEach((p, i) => { times[p] = matrices[i].minutes; });
    if (matrices.some(m => m.estimated)) {
      warnings.push('Routing service unavailable: driving, cycling and walking times are estimated from distance.');
    }
    const bus = destCoords.map(d => busMinutesMany(candidates, d)); // [dest][candidate]
    times['bus-transit'] = candidates.map((_, i) => destinations.map((_, j) => bus[j][i]));
  }

  // ---- score every candidate ----
  const locations = candidates.map((pt, i) => {
    let amenityScore = 0;
    const amenityData: Record<string, unknown> = {};
    const amenityBreakdown: Record<string, unknown> = {};
    const lists: Record<string, Feature[]> = { school: schools, hospital: amenities.hospital, supermarket: amenities.supermarket };

    for (const [type, list] of Object.entries(lists)) {
      const weight = amenityWeights[type] || 0;
      const hit = weight > 0 ? nearest(pt, list) : null;
      if (!hit) continue;
      const score = Math.max(0, 1 - hit.distance / 1000 / AMENITY_REFERENCE_KM[type]) * weight;
      amenityScore += score;
      const entry: Record<string, unknown> = {
        name: hit.item.name, distance: Math.round(hit.distance), lat: hit.item.lat, lon: hit.item.lon, weight, score,
      };
      if (type === 'school') {
        entry.school_type = hit.item.schoolType;
        const top = allTopSchools[hit.item.name];
        if (top) Object.assign(entry, { is_top_rated: true, rank: top.rank, rating: top.rating });
      }
      amenityData[type] = entry;
      amenityBreakdown[type] = { weight, score, max_score: weight };
    }
    amenityScore = round1(amenityScore);

    const transitScore = calculateTransitScore(pt.lat, pt.lon);
    const transitWeighted = round1((transitScore / 100) * 20);

    const travelScores: Record<string, unknown> = {};
    const transportModes: Record<string, unknown> = {};
    let weeklyMinutes = 0;
    destinations.forEach((dest, j) => {
      const all: Partial<Record<ModeKey, number>> = {};
      for (const key of [...ORS_PROFILES, 'bus-transit'] as ModeKey[]) {
        const t = times[key]?.[i]?.[j];
        if (t != null) all[key] = t;
      }
      const chosen = chooseMode(dest.mode, all);
      if (!chosen) return;
      const type = dest.type || 'Home';
      const key = `${type}-${dest.postcode}`;
      const frequency = Number(dest.frequency) || 1;
      travelScores[key] = {
        travel_time: chosen.duration, frequency, transport_mode: chosen.mode,
        all_times: chosen.allTimes, type, postcode: dest.postcode,
      };
      transportModes[key] = {
        selected_mode: travelMode !== 'auto' ? MODE_TO_KEY[travelMode] : chosen.mode,
        travel_time_minutes: chosen.duration,
        alternative_modes: chosen.allTimes,
      };
      weeklyMinutes += chosen.duration * frequency;
    });

    // Score falls linearly as weekly travel time approaches 10 hours
    const travelScore = destinations.length
      ? round1(Math.max(0, (MAX_WEEKLY_MINUTES - weeklyMinutes) / MAX_WEEKLY_MINUTES) * 40)
      : 0;

    return {
      lat: pt.lat,
      lon: pt.lon,
      category: 'Recommended Location',
      amenities: amenityData,
      score: round1(amenityScore + transitWeighted + travelScore),
      travel_scores: travelScores,
      transit: { score: transitScore, accessible_routes: getRouteAccessibility(pt.lat, pt.lon) },
      transport_modes: transportModes,
      score_breakdown: {
        amenities: { total: amenityScore, breakdown: amenityBreakdown, weights: amenityWeights },
        transit: { score: transitWeighted, raw_score: transitScore },
        travel: travelScore,
        travel_details: { score: travelScore, mode_preference: travelMode, travel_times: travelScores },
      },
      area_name: nearest(pt, amenities.places)?.item.name || 'Unknown Area',
      google_maps_link: `https://www.google.com/maps?q=${pt.lat},${pt.lon}`,
    };
  });

  locations.sort((a, b) => b.score - a.score);
  return { city: cityQuery, locations: locations.slice(0, 5), ...(warnings.length ? { warnings } : {}) };
}

function filterSchools(schools: Feature[], filter: 'primary' | 'secondary' | 'both'): Feature[] {
  if (filter === 'both') return schools;
  const matching = schools.filter(s => s.schoolType === (filter as SchoolType));
  return matching.length ? matching : schools;
}

/** Same rules as calculate_travel_time(): auto = fastest; bus falls back to walk/cycle/drive. */
function chooseMode(mode: Mode, all: Partial<Record<ModeKey, number>>) {
  const entries = Object.entries(all) as Array<[ModeKey, number]>;
  if (!entries.length) return null;
  if (mode === 'auto') {
    const [m, d] = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
    return { mode: m, duration: d, allTimes: all };
  }
  if (mode === 'bus') {
    if (all['bus-transit'] != null) return { mode: 'bus-transit' as ModeKey, duration: all['bus-transit'], allTimes: all };
    for (const fallback of ['foot-walking', 'cycling-regular', 'driving-car'] as const) {
      const { ['bus-transit']: _, ...rest } = all;
      if (all[fallback] != null) return { mode: fallback, duration: all[fallback]!, allTimes: rest };
    }
    return null;
  }
  const key = MODE_TO_KEY[mode] ?? 'driving-car';
  const d = all[key];
  return d == null ? null : { mode: key, duration: d, allTimes: { [key]: d } };
}
