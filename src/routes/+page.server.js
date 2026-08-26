import { loadCatalog } from "$lib/server/catalog-store.js";
import { getNeedsMatch, getPsnCredential } from "$lib/server/api-client.js";

// The two manual-API calls below only decide whether to show the "Fix IGDB"
// and "Stale PSN Token" nav links. Mailroom's /manual/needs-match call can be
// slow (~1s), and blocking the catalog page on it every load is the main
// remaining cause of the sluggish homepage (the catalog store itself is now
// cached). Cache the counts briefly so only the first load per window pays the
// API round-trip; the links may lag the catalog by up to TTL but that's fine.
const NAV_CACHE_TTL_MS = 30_000;
let navCache = null; // { needsMatchCount, psnNeedsRefresh, loadedAt }

/** Fetch (and briefly cache) the counts used only to show/hide nav links. */
async function getNavMetrics() {
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

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const games = loadCatalog();
  const { needsMatchCount, psnNeedsRefresh } = await getNavMetrics();
  return { games, needsMatchCount, psnNeedsRefresh };
}
