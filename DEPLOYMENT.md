# Cloud Deployment (Cloudflare + Neon)

The app now runs entirely in the cloud — no home servers, no OpenTripPlanner, no
self-hosted OpenRouteService, no ngrok.

```
Browser ──► Cloudflare Worker  (source-code/worker)
             ├─ serves the React app (source-code/client/dist)
             └─ /api/*  ──► Neon Postgres        user data + cache
                        ──► openrouteservice.org driving / cycling / walking times
                        ──► Nominatim + Overpass city boundary, schools, hospitals, supermarkets
                        ──► postcodes.io         postcode lookup
             bus times + transit score: precomputed from the GTFS feed, bundled in the Worker
```

| Before (self-hosted)                  | Now                                                        |
|---------------------------------------|------------------------------------------------------------|
| Flask + osmnx/geopandas/pandas        | TypeScript Cloudflare Worker                               |
| OpenTripPlanner on `192.168.1.161`    | RAPTOR bus routing precomputed from `server/GTFS` at build time |
| ORS on `192.168.1.162`                | openrouteservice.org hosted API (matrix: 3 calls per search) |
| Firestore (user data)                 | Neon Postgres via `/api/me`                                |
| Firebase Auth                         | Firebase Auth (Google sign-in only, unchanged)             |
| Hard-coded `82.10.48.243:5000`        | Same-origin `/api`                                         |

Everything degrades gracefully: without `ORS_API_KEY` travel times are estimated from
distance; without `DATABASE_URL` searches still work but nothing is cached or saved;
if Overpass is down, the last cached data is served.

## One-time setup

### 1. Neon database
1. Create a free project at <https://console.neon.tech>.
2. Copy the **pooled** connection string (`postgresql://…-pooler…neon.tech/neondb?sslmode=require`).

Tables are created automatically on first request (schema in `source-code/worker/src/db.ts`).

### 2. openrouteservice key
Sign up at <https://account.heigit.org/signup> (HeiGIT runs openrouteservice) and copy the free Standard API key from the dashboard
(free tier: 500 matrix requests/day ≈ 160 searches/day, 2000 directions/day).

### 3. Firebase sign-in domain
Firebase console → project **streetnetworkanalysis** → Authentication → Settings →
**Authorized domains** → add `location-score-analyzer.<your-subdomain>.workers.dev`
(and any custom domain). Without this, "Sign in with Google" fails on the live site.

### 4. Mapbox token
The map needs a public Mapbox token at build time. Copy `source-code/client/.env.example`
to `source-code/client/.env` (git-ignored) and set `VITE_MAPBOX_TOKEN`.

### 5. Deploy
```bash
cd source-code/worker
npm install
npx wrangler login
npx wrangler secret put DATABASE_URL   # paste the Neon connection string
npx wrangler secret put ORS_API_KEY    # paste the ORS key
npm run deploy                         # builds the React app, then deploys the Worker
```
`wrangler deploy` prints the live URL. Check `https://<url>/api/health` — it should
report `"database": true` and `"routing": "openrouteservice"`.

## Local development
```bash
cd source-code/worker
cp .dev.vars.example .dev.vars          # fill in values (optional)
npm run build:client && npm run dev     # app + API on http://localhost:8787
```
For hot reload of the React app, also run `npm run dev` in `source-code/client`
(Vite proxies `/api` to `localhost:8787`).

## Updating bus timetables
The bundled GTFS (`source-code/server/GTFS`) is a January 2025 Cardiff Bus / Newport Bus
feed. Bus times use a representative weekday from it, so it keeps working after the feed's
end date, but timetables drift over time. To refresh, download the Wales GTFS from the
[Bus Open Data Service](https://data.bus-data.dft.gov.uk/timetable/download/), then:
```bash
cd source-code/worker
npm run build:transit -- /path/to/new/GTFS
npm run deploy
```

## Free-tier notes
- **Cloudflare Workers free**: 100k requests/day, 10 ms CPU per request. Bus routing is
  precomputed so searches stay light; if you ever see "Exceeded CPU limit" errors in
  `npx wrangler tail`, the $5/month Workers Paid plan removes that limit.
- **Neon free**: scales to zero when idle; the first request after a pause takes ~0.5 s longer.
- **Nominatim / Overpass** are free community services with fair-use policies; results are
  cached for 30 / 14 days so each city is only fetched occasionally.
- Restrict the Mapbox token (`client/.env`) to your deployed URL in the Mapbox dashboard.
