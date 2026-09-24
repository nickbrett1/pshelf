// Counts that only decide whether the catalog nav shows the "Fix IGDB" and
// "Stale PSN Token" links. mailroom's /manual/needs-match call can be slow
// (~1s), so we cache the result briefly instead of blocking every catalog load
// on it.
//
// IMPORTANT: because the cache is module-level (per server process), a write
// that changes one of these counts — e.g. refreshing the PSN credential on
// /psn — must call invalidateNavMetrics() so the link clears immediately
// rather than lingering for up to NAV_CACHE_TTL_MS. Missing this was why a
// successful PSN refresh still left the red "Stale PSN Token" link showing on
// the catalog (SvelteKit replays the cached page data on Back/Forward, so the
// stale flag reappears even after the credential is valid).
import { getNeedsMatch, getPsnCredential } from "$lib/server/api-client.js";

const NAV_CACHE_TTL_MS = 30_000;

/** @typedef {{ needsMatchCount: number, psnNeedsRefresh: boolean, loadedAt: number }} NavMetrics */

/** @type {NavMetrics|null} */
let navCache = null;

/** Fetch (and briefly cache) the counts used only to show/hide nav links.
 * @returns {Promise<{needsMatchCount: number, psnNeedsRefresh: boolean}>} */
export async function getNavMetrics() {
  const now = Date.now();
  if (navCache && now - navCache.loadedAt < NAV_CACHE_TTL_MS) {
    return navCache;
  }
  const [needsMatch, credential] = await Promise.all([
    getNeedsMatch({ timeout: 2000 }),
    getPsnCredential({ timeout: 2000 }),
  ]);
  navCache = {
    // "Fix IGDB" link: only when there are unmatched games.
    needsMatchCount: needsMatch.length,
    // "Refresh PSN" link: only when the PSN credential needs refreshing.
    psnNeedsRefresh: credential.status === "needs_refresh",
    loadedAt: Date.now(),
  };
  return navCache;
}

/**
 * Drop the cached nav counts so the next catalog load reflects a write (e.g. a
 * successful PSN credential refresh). Without this the red link stays for up
 * to NAV_CACHE_TTL_MS.
 */
export function invalidateNavMetrics() {
  navCache = null;
}
