import { loadCatalog } from "$lib/server/catalog-store.js";
import { getNeedsMatch, getPsnCredential } from "$lib/server/api-client.js";
import { parseAcquisitionDate } from "$lib/catalog.js";

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

/**
 * Latest acquisition/purchase date for a game, as a sortable number (null when
 * unknown). Mirrors the old client-side `purchaseDate()` logic so the "Sort by
 * Purchase Date" order is unchanged — but computed on the server so the client
 * doesn't need every game's `editions` array just to sort.
 * @param {Object} g full mapped catalog row
 * @returns {number|null}
 */
function maxAcquisitionDate(g) {
  const dates = (g.editions ?? [])
    .map((e) => parseAcquisitionDate(e.acquisition_date))
    .filter((d) => d != null);
  const earliest = parseAcquisitionDate(g.earliest_acquisition);
  if (earliest != null) dates.push(earliest);
  return dates.length ? Math.max(...dates) : null;
}

/**
 * Project a catalog game onto only the fields the catalog UI needs up front.
 * The per-game `editions` arrays (the largest slice of the old payload) are
 * deliberately NOT shipped here — they're only shown when a card is expanded,
 * so they're lazy-loaded on demand via /api/game/[id]/editions. We ship a
 * precomputed `purchase_date` sort key instead so "Sort by Purchase Date"
 * keeps working. Other unused fields (`year`, top-level `price`, `provenance`)
 * are dropped too. See memo "Pshelf slow to load".
 * @param {Object} g mapped catalog row (see mapRow)
 * @returns {Object} slimmed row for transport
 */
function slimGame(g) {
  return {
    id: g.id,
    key: g.key,
    title: g.title,
    cover: g.cover,
    psvr2: g.psvr2,
    platforms: g.platforms,
    formats: g.formats,
    ownership_classes: g.ownership_classes,
    genres: g.genres,
    retailer: g.retailer,
    rating: g.rating,
    num_editions: g.num_editions,
    purchased: g.purchased,
    igdb_id: g.igdb_id,
    purchase_date: maxAcquisitionDate(g),
  };
}

/** @type {import('./$types').PageServerLoad} */
export function load() {
  const games = loadCatalog().map(slimGame);
  return {
    games,
    // getNavMetrics hits mailroom's manual API and can take ~1s. Return it as
    // an un-awaited promise so SvelteKit 2 streams it: the catalog renders
    // immediately from the (cached) store and the nav links pop in when the
    // counts resolve. getNavMetrics never rejects (its fetches swallow errors).
    nav: getNavMetrics(),
  };
}
