// Neon Postgres: user profiles (replacing Firestore) and a cache for slow
// third-party lookups (Nominatim, Overpass, postcodes.io).
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  uid                text PRIMARY KEY,
  email              text,
  saved_postcodes    jsonb NOT NULL DEFAULT '[]'::jsonb,
  travel_preferences jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS api_cache (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS api_cache_expires_at ON api_cache (expires_at);
`;

type Sql = NeonQueryFunction<false, false>;
let schemaReady: Promise<void> | null = null;

/** Returns a query function, or null when no database is configured. */
export async function getDb(env: Env): Promise<Sql | null> {
  if (!env.DATABASE_URL) return null;
  const sql = neon(env.DATABASE_URL);
  // Create tables on first use, so a fresh Neon database needs no manual setup.
  schemaReady ??= (async () => {
    for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) await sql.query(stmt);
  })().catch(err => { schemaReady = null; throw err; });
  await schemaReady;
  return sql;
}

// Hot results also stay in isolate memory to skip a database round trip.
const memory = new Map<string, { value: unknown; expires: number }>();

/**
 * Returns a cached value, or computes and stores it. If the value has expired and
 * recomputing fails (e.g. Overpass is down), the stale value is served instead.
 */
export async function cached<T>(env: Env, ctx: ExecutionContext, key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && mem.expires > now) return mem.value as T;

  let sql: Sql | null = null;
  let stale: T | undefined;
  try {
    sql = await getDb(env);
    if (sql) {
      const rows = await sql`SELECT value, expires_at FROM api_cache WHERE key = ${key}`;
      if (rows.length) {
        const expires = new Date(rows[0].expires_at as string).getTime();
        if (expires > now) {
          memory.set(key, { value: rows[0].value, expires });
          return rows[0].value as T;
        }
        stale = rows[0].value as T;
      }
    }
  } catch (err) {
    console.error('Cache read failed', err);
  }

  let value: T;
  try {
    value = await compute();
  } catch (err) {
    if (stale !== undefined) {
      console.warn(`Serving stale cache for ${key}`, err);
      return stale;
    }
    throw err;
  }

  const expires = now + ttlSeconds * 1000;
  memory.set(key, { value, expires });
  if (memory.size > 200) memory.delete(memory.keys().next().value!);
  if (sql) {
    const db = sql;
    ctx.waitUntil(
      db`INSERT INTO api_cache (key, value, expires_at)
         VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${new Date(expires).toISOString()})
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`
        .catch(err => console.error('Cache write failed', err)),
    );
    // Occasionally remove rows that expired over 30 days ago (kept until then as stale fallbacks).
    // Done here rather than with a cron trigger, which the free plan limits per account.
    if (Math.random() < 0.02) {
      ctx.waitUntil(
        db`DELETE FROM api_cache WHERE expires_at < now() - interval '30 days'`
          .catch(err => console.error('Cache prune failed', err)),
      );
    }
  }
  return value;
}

export const DEFAULT_PREFERENCES = {
  locations: [],
  amenityWeights: { school: 15, hospital: 15, supermarket: 10 },
  travelMode: 'auto',
  schoolFilter: 'both',
};

export async function getUser(sql: Sql, uid: string, email: string | undefined) {
  const rows = await sql`
    INSERT INTO users (uid, email, travel_preferences)
    VALUES (${uid}, ${email ?? null}, ${JSON.stringify(DEFAULT_PREFERENCES)}::jsonb)
    ON CONFLICT (uid) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
    RETURNING saved_postcodes, travel_preferences`;
  return { savedPostcodes: rows[0].saved_postcodes, travelPreferences: rows[0].travel_preferences };
}

export async function updateUser(sql: Sql, uid: string, patch: { savedPostcodes?: unknown; travelPreferences?: unknown }) {
  const rows = await sql`
    UPDATE users SET
      saved_postcodes    = COALESCE(${patch.savedPostcodes === undefined ? null : JSON.stringify(patch.savedPostcodes)}::jsonb, saved_postcodes),
      travel_preferences = COALESCE(${patch.travelPreferences === undefined ? null : JSON.stringify(patch.travelPreferences)}::jsonb, travel_preferences),
      updated_at = now()
    WHERE uid = ${uid}
    RETURNING saved_postcodes, travel_preferences`;
  if (!rows.length) return null;
  return { savedPostcodes: rows[0].saved_postcodes, travelPreferences: rows[0].travel_preferences };
}
