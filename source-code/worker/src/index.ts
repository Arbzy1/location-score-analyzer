// Location Score Analyzer API on Cloudflare Workers. Everything under /api/* is
// handled here; all other paths are the React app's static assets.
import { analyzeLocation, AnalysisError, type Preferences } from './analyze';
import { authenticate } from './auth';
import { getDb, getUser, updateUser } from './db';
import { nearest } from './geo';
import { allTopSchools, getAmenitiesAround, lookupPostcode, postcodeToLatLon } from './osm';
import { directions, ORS_PROFILES, type OrsProfile } from './routing';
import { transitInfo } from './transit';

const json = (data: unknown, status = 200) => Response.json(data, { status });

async function handleApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  const method = request.method;

  if (path === '/health') {
    return json({
      status: 'healthy',
      database: Boolean(env.DATABASE_URL),
      routing: env.ORS_API_KEY ? 'openrouteservice' : 'estimated',
      transit: transitInfo,
    });
  }

  if (path === '/amenities' && (method === 'GET' || method === 'POST')) {
    let city = url.searchParams.get('city') || 'Cardiff, UK';
    let prefs: Preferences | null = null;
    if (method === 'POST') {
      const body = await request.json<{ city?: string; travel_preferences?: Preferences }>();
      city = body.city || city;
      prefs = body.travel_preferences || null;
    } else {
      const raw = url.searchParams.get('travel_preferences');
      if (raw && raw !== 'null') {
        try { prefs = JSON.parse(raw); } catch { return json({ error: 'travel_preferences is not valid JSON', locations: [] }, 400); }
      }
    }
    try {
      return json(await analyzeLocation(env, ctx, city, prefs));
    } catch (err) {
      console.error('Analysis failed', err);
      const status = err instanceof AnalysisError ? err.status : 502;
      return json({ error: (err as Error).message, locations: [] }, status);
    }
  }

  if (path === '/bus-routes') {
    // Pre-built from the GTFS feed and served as a static asset
    const res = await env.ASSETS.fetch(new URL('/data/bus-routes.json', url));
    return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });
  }

  const postcodeMatch = path.match(/^\/postcode\/([^/]+)(\/amenities)?$/);
  if (postcodeMatch) {
    const postcode = decodeURIComponent(postcodeMatch[1]);
    if (!postcodeMatch[2]) {
      const data = await lookupPostcode(env, ctx, postcode);
      return json(data, data.status === 200 ? 200 : data.status || 404);
    }
    const pt = await postcodeToLatLon(env, ctx, postcode);
    if (!pt) return json({ error: 'Invalid postcode' }, 400);
    const found = await getAmenitiesAround(env, ctx, pt);
    const result: Record<string, unknown> = {};
    for (const type of ['school', 'hospital', 'supermarket'] as const) {
      const hit = nearest(pt, found[type]);
      if (!hit) continue;
      const top = type === 'school' ? allTopSchools[hit.item.name] : undefined;
      result[type] = {
        name: hit.item.name, distance: Math.round(hit.distance), lat: hit.item.lat, lon: hit.item.lon,
        ...(type === 'school' ? { school_type: hit.item.schoolType } : {}),
        ...(top ? { is_top_rated: true, rank: top.rank, rating: top.rating } : {}),
      };
    }
    return json(result);
  }

  if (path === '/directions') {
    const profile = (url.searchParams.get('profile') || 'driving-car') as OrsProfile;
    const parse = (s: string | null) => {
      const [lon, lat] = (s || '').split(',').map(Number);
      return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
    };
    const start = parse(url.searchParams.get('start')), end = parse(url.searchParams.get('end'));
    if (!ORS_PROFILES.includes(profile) || !start || !end) {
      return json({ error: 'Use ?profile=driving-car&start=lon,lat&end=lon,lat' }, 400);
    }
    return directions(env, profile, start, end);
  }

  if (path === '/me') {
    const user = await authenticate(request, env);
    if (!user) return json({ error: 'Sign in required' }, 401);
    const sql = await getDb(env);
    if (!sql) return json({ error: 'Saving data is not configured on this server' }, 503);
    if (method === 'GET') return json(await getUser(sql, user.uid, user.email));
    if (method === 'PUT' || method === 'PATCH') {
      const body = await request.json<{ savedPostcodes?: unknown; travelPreferences?: unknown }>();
      await getUser(sql, user.uid, user.email); // make sure the row exists
      return json(await updateUser(sql, user.uid, body));
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, ctx, url);
      } catch (err) {
        console.error('Unhandled API error', err);
        return json({ error: 'Internal error' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
