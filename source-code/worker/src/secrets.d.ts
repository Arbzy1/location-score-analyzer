// Secrets set with `wrangler secret put` (or .dev.vars locally). Both are optional.
interface Env {
  DATABASE_URL?: string;
  ORS_API_KEY?: string;
}
