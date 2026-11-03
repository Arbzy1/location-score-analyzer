// Precomputes everything the Worker needs from the GTFS feed, replacing the
// self-hosted OpenTripPlanner server.
//
//   node scripts/build-transit.mjs [path/to/GTFS]
//
// Outputs:
//   src/data/transit.json                 - stops, routes, stop clusters and a
//                                           cluster-to-cluster bus travel time matrix
//   ../client/public/data/bus-routes.json - GeoJSON for the map's bus layer
//
// Bus travel times are computed with RAPTOR (round-based public transit routing)
// on a representative weekday, departing every 15 minutes in the morning peak,
// and averaged so the waiting time at the first stop is included.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gtfsDir = path.resolve(process.argv[2] || path.join(here, '../../server/GTFS'));
const outTransit = path.join(here, '../src/data/transit.json');
const outGeojson = path.join(here, '../../client/public/data/bus-routes.json');

const CLUSTER_RADIUS_M = 250;     // stops this close are treated as one place
const TRANSFER_RADIUS_M = 300;    // max walk between stops when changing bus
const WALK_M_PER_MIN = 80;        // ~4.8 km/h
const WALK_DETOUR = 1.3;          // straight line -> street distance
const MAX_ROUNDS = 3;             // up to 3 buses (2 changes)
const DEPARTURES = ['07:45', '08:00', '08:15', '08:30'];
const MAX_MINUTES = 240;          // 255 in the matrix means unreachable

// ---------- CSV ----------
function parseCsv(file) {
  const text = fs.readFileSync(path.join(gtfsDir, file), 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

const toSeconds = t => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};
const walkSeconds = metres => (metres * WALK_DETOUR / WALK_M_PER_MIN) * 60;

console.log(`Reading GTFS from ${gtfsDir}`);
const agencies = parseCsv('agency.txt');
const routesCsv = parseCsv('routes.txt');
const stopsCsv = parseCsv('stops.txt');
const tripsCsv = parseCsv('trips.txt');
const stopTimesCsv = parseCsv('stop_times.txt');
const calendar = parseCsv('calendar.txt');
const calendarDates = fs.existsSync(path.join(gtfsDir, 'calendar_dates.txt')) ? parseCsv('calendar_dates.txt') : [];
const shapesCsv = fs.existsSync(path.join(gtfsDir, 'shapes.txt')) ? parseCsv('shapes.txt') : [];

// ---------- stops & routes ----------
const stops = stopsCsv
  .filter(s => s.stop_lat && s.stop_lon && (s.location_type || '0') === '0')
  .map(s => ({ id: s.stop_id, name: s.stop_name || 'Unknown Stop', lat: +s.stop_lat, lon: +s.stop_lon }));
const stopIndex = new Map(stops.map((s, i) => [s.id, i]));

const agencyName = new Map(agencies.map(a => [a.agency_id, a.agency_name]));
const routes = routesCsv.map(r => ({
  id: r.route_id,
  ref: r.route_short_name || '',
  name: r.route_long_name || `Route ${r.route_short_name}`,
  operator: agencyName.get(r.agency_id) || agencies[0]?.agency_name || '',
}));
const routeIndex = new Map(routes.map((r, i) => [r.id, i]));
const tripById = new Map(tripsCsv.map(t => [t.trip_id, t]));

// stop_times grouped by trip
const tripStops = new Map();
for (const st of stopTimesCsv) {
  const si = stopIndex.get(st.stop_id);
  if (si === undefined || !st.arrival_time) continue;
  let list = tripStops.get(st.trip_id);
  if (!list) tripStops.set(st.trip_id, list = []);
  list.push({ seq: +st.stop_sequence, stop: si, arr: toSeconds(st.arrival_time), dep: toSeconds(st.departure_time || st.arrival_time) });
}
for (const list of tripStops.values()) list.sort((a, b) => a.seq - b.seq);

// Routes serving each stop, across the whole feed (same as the old transit score)
const stopRoutes = stops.map(() => new Set());
for (const [tripId, list] of tripStops) {
  const ri = routeIndex.get(tripById.get(tripId)?.route_id);
  if (ri === undefined) continue;
  for (const st of list) stopRoutes[st.stop].add(ri);
}

// ---------- pick a representative weekday ----------
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const weekdayCols = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const exceptions = new Map();
for (const cd of calendarDates) {
  if (!exceptions.has(cd.date)) exceptions.set(cd.date, new Map());
  exceptions.get(cd.date).set(cd.service_id, cd.exception_type);
}
function activeServices(dateStr, dow) {
  const active = new Set();
  for (const c of calendar) {
    if (c[weekdayCols[dow]] === '1' && c.start_date <= dateStr && dateStr <= c.end_date) active.add(c.service_id);
  }
  for (const [sid, type] of exceptions.get(dateStr) || []) {
    if (type === '1') active.add(sid); else if (type === '2') active.delete(sid);
  }
  return active;
}
const tripsPerService = new Map();
for (const t of tripsCsv) tripsPerService.set(t.service_id, (tripsPerService.get(t.service_id) || 0) + 1);

const starts = calendar.map(c => c.start_date).sort();
const ends = calendar.map(c => c.end_date).sort();
const parse = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
let best = null;
for (let d = parse(starts[0]); d <= parse(ends[ends.length - 1]); d.setUTCDate(d.getUTCDate() + 1)) {
  const dow = d.getUTCDay();
  if (dow < 2 || dow > 4) continue; // Tue-Thu
  const ds = ymd(d);
  const services = activeServices(ds, dow);
  let count = 0;
  for (const s of services) count += tripsPerService.get(s) || 0;
  if (!best || count > best.count) best = { date: ds, services, count };
}
console.log(`Reference weekday: ${best.date} (${best.count} trips)`);

// ---------- RAPTOR structures ----------
const patterns = new Map(); // key: stop sequence
for (const t of tripsCsv) {
  if (!best.services.has(t.service_id)) continue;
  const list = tripStops.get(t.trip_id);
  if (!list || list.length < 2) continue;
  const key = list.map(s => s.stop).join(',');
  let p = patterns.get(key);
  if (!p) patterns.set(key, p = { stops: list.map(s => s.stop), trips: [] });
  p.trips.push({ arr: list.map(s => s.arr), dep: list.map(s => s.dep) });
}
const patternList = [...patterns.values()];
for (const p of patternList) p.trips.sort((a, b) => a.dep[0] - b.dep[0]);
const stopPatterns = stops.map(() => []);
patternList.forEach((p, pi) => p.stops.forEach((s, pos) => stopPatterns[s].push([pi, pos])));

// Walking transfers between nearby stops
const footpaths = stops.map(() => []);
for (let i = 0; i < stops.length; i++) {
  for (let j = i + 1; j < stops.length; j++) {
    const d = haversine(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon);
    if (d <= TRANSFER_RADIUS_M) {
      const w = walkSeconds(d);
      footpaths[i].push([j, w]);
      footpaths[j].push([i, w]);
    }
  }
}

// ---------- cluster stops into places ----------
const clusters = []; // { lat, lon, members: [[stop, walkSec]] }
const servedStops = stops.map((_, i) => stopPatterns[i].length > 0 || stopRoutes[i].size > 0);
for (let i = 0; i < stops.length; i++) {
  if (!servedStops[i]) continue;
  const s = stops[i];
  let home = null;
  for (const c of clusters) {
    if (haversine(c.lat, c.lon, s.lat, s.lon) <= CLUSTER_RADIUS_M) { home = c; break; }
  }
  if (!home) clusters.push(home = { lat: s.lat, lon: s.lon, members: [] });
  home.members.push(i);
}
for (const c of clusters) {
  c.members = c.members.map(i => [i, walkSeconds(haversine(c.lat, c.lon, stops[i].lat, stops[i].lon))]);
}
const stopCluster = new Int32Array(stops.length).fill(-1);
clusters.forEach((c, ci) => c.members.forEach(([s]) => { stopCluster[s] = ci; }));
console.log(`${stops.length} stops -> ${clusters.length} clusters, ${patternList.length} patterns`);

// ---------- RAPTOR ----------
const INF = Number.POSITIVE_INFINITY;
function raptor(sources, departure) {
  const n = stops.length;
  const bestArr = new Float64Array(n).fill(INF);
  let prev = new Float64Array(n).fill(INF);
  let marked = new Set();
  for (const [s, w] of sources) {
    const t = departure + w;
    if (t < bestArr[s]) { bestArr[s] = t; prev[s] = t; marked.add(s); }
  }
  const limit = departure + MAX_MINUTES * 60;
  for (let round = 0; round < MAX_ROUNDS && marked.size; round++) {
    const cur = Float64Array.from(prev);
    // Patterns to scan, from the earliest marked stop on each
    const queue = new Map();
    for (const s of marked) {
      for (const [pi, pos] of stopPatterns[s]) {
        if (!queue.has(pi) || queue.get(pi) > pos) queue.set(pi, pos);
      }
    }
    const newlyMarked = new Set();
    for (const [pi, startPos] of queue) {
      const p = patternList[pi];
      let trip = null;
      for (let pos = startPos; pos < p.stops.length; pos++) {
        const s = p.stops[pos];
        if (trip && trip.arr[pos] < bestArr[s] && trip.arr[pos] <= limit) {
          cur[s] = Math.min(cur[s], trip.arr[pos]);
          bestArr[s] = trip.arr[pos];
          newlyMarked.add(s);
        }
        // Can we catch an earlier trip here?
        if (prev[s] < INF && (!trip || prev[s] <= trip.dep[pos])) {
          let lo = 0, hi = p.trips.length;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (p.trips[mid].dep[pos] >= prev[s]) hi = mid; else lo = mid + 1; }
          if (lo < p.trips.length && (!trip || p.trips[lo].dep[pos] < trip.dep[pos])) trip = p.trips[lo];
        }
      }
    }
    // Walking transfers
    for (const s of [...newlyMarked]) {
      for (const [t, w] of footpaths[s]) {
        const a = cur[s] + w;
        if (a < bestArr[t]) { bestArr[t] = a; cur[t] = Math.min(cur[t], a); newlyMarked.add(t); }
      }
    }
    prev = cur;
    marked = newlyMarked;
  }
  return bestArr;
}

const N = clusters.length;
const matrix = new Uint8Array(N * N).fill(255);
const departures = DEPARTURES.map(t => toSeconds(`${t}:00`));
const t0 = Date.now();
for (let a = 0; a < N; a++) {
  const sums = new Float64Array(N), counts = new Uint8Array(N);
  for (const dep of departures) {
    const arr = raptor(clusters[a].members, dep);
    const clusterArr = new Float64Array(N).fill(INF);
    for (let s = 0; s < stops.length; s++) {
      if (arr[s] === INF || stopCluster[s] < 0) continue;
      const c = stopCluster[s];
      const member = clusters[c].members.find(m => m[0] === s);
      clusterArr[c] = Math.min(clusterArr[c], arr[s] + member[1]);
    }
    for (let b = 0; b < N; b++) {
      if (clusterArr[b] < INF) { sums[b] += clusterArr[b] - dep; counts[b]++; }
    }
  }
  for (let b = 0; b < N; b++) {
    if (a === b) { matrix[a * N + b] = 0; continue; }
    // Only trust pairs that are reachable for most departure times
    if (counts[b] * 2 >= departures.length) {
      matrix[a * N + b] = Math.min(MAX_MINUTES, Math.round(sums[b] / counts[b] / 60));
    }
  }
}
console.log(`RAPTOR matrix ${N}x${N} computed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---------- write transit.json ----------
const round5 = x => Math.round(x * 1e5) / 1e5;
fs.mkdirSync(path.dirname(outTransit), { recursive: true });
fs.writeFileSync(outTransit, JSON.stringify({
  source: path.basename(gtfsDir),
  referenceDate: best.date,
  departures: DEPARTURES,
  routes: routes.map(r => ({ id: r.id, ref: r.ref, name: r.name })),
  // [lat, lon, ...routeIndexes]
  stops: stops.map((s, i) => [round5(s.lat), round5(s.lon), ...stopRoutes[i]]),
  clusters: clusters.map(c => [round5(c.lat), round5(c.lon)]),
  matrix: Buffer.from(matrix).toString('base64'),
}));
console.log(`Wrote ${outTransit} (${(fs.statSync(outTransit).size / 1024).toFixed(0)} KB)`);

// ---------- write bus-routes.json for the map ----------
function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [x1, y1] = points[s], [x2, y2] = points[e];
    const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [x, y] = points[i];
      const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0;
      const d = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol * tol) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

const shapes = new Map();
for (const p of shapesCsv) {
  if (!shapes.has(p.shape_id)) shapes.set(p.shape_id, []);
  shapes.get(p.shape_id).push([+p.shape_pt_sequence, +p.shape_pt_lon, +p.shape_pt_lat]);
}
const routeFeatures = [];
for (const r of routes) {
  const counts = new Map();
  for (const t of tripsCsv) if (t.route_id === r.id && t.shape_id) counts.set(t.shape_id, (counts.get(t.shape_id) || 0) + 1);
  const shapeId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pts = shapes.get(shapeId);
  if (!pts) continue;
  const coords = simplify(
    pts.sort((a, b) => a[0] - b[0]).map(([, lon, lat]) => [lon, lat]).filter(([lon, lat]) => Math.abs(lon) <= 180 && Math.abs(lat) <= 90),
    0.00003,
  ).map(([lon, lat]) => [round5(lon), round5(lat)]);
  if (coords.length < 2) continue;
  routeFeatures.push({
    type: 'Feature', id: r.id,
    properties: { id: r.id, name: r.name, ref: r.ref, type: 'bus_route', operator: r.operator },
    geometry: { type: 'LineString', coordinates: coords },
  });
}
const stopFeatures = stops.filter((_, i) => servedStops[i]).map(s => ({
  type: 'Feature', id: s.id,
  properties: { id: s.id, name: s.name, type: 'bus_stop' },
  geometry: { type: 'Point', coordinates: [round5(s.lon), round5(s.lat)] },
}));
fs.mkdirSync(path.dirname(outGeojson), { recursive: true });
fs.writeFileSync(outGeojson, JSON.stringify({
  routes: { type: 'FeatureCollection', features: routeFeatures },
  stops: { type: 'FeatureCollection', features: stopFeatures },
}));
console.log(`Wrote ${outGeojson} (${routeFeatures.length} routes, ${stopFeatures.length} stops, ${(fs.statSync(outGeojson).size / 1024).toFixed(0)} KB)`);
