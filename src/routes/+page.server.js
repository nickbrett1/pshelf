import { loadCatalog } from "$lib/server/catalog-store.js";
import { getNavMetrics } from "$lib/server/nav-metrics.js";
import { parseAcquisitionDate } from "$lib/catalog.js";

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
    // Release date (epoch seconds) as a sort key and for the expanded-card
    // "Released <date>" line — see note in catalog-store's mapRow.
    release_ts: g.release_ts,
    price: g.price,
    num_editions: g.num_editions,
    purchased: g.purchased,
    igdb_id: g.igdb_id,
    // Canonical IGDB page URL for the expanded card's "more info" link (see
    // mapRow). One small string; the raw IGDB payload never leaves the server.
    igdb_url: g.igdb_url,
    // Canonical normalized title + play state: the play-state editor needs a
    // stable identity to write back (igdb_id when matched, normalized title
    // otherwise) and the stored state to render.
    normalized_title: g.normalized_title,
    play_state: g.play_state,
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
