import { loadCatalog } from "$lib/server/catalog-store.js";
import { getNeedsMatch, getPsnCredential } from "$lib/server/api-client.js";

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const games = loadCatalog();
  // Fetch, in parallel, the two counts used to show/hide nav links. Short,
  // tolerant timeouts so a down mailroom API can't stall the catalog page.
  const [needsMatch, credential] = await Promise.all([
    getNeedsMatch({ timeout: 1200 }),
    getPsnCredential({ timeout: 1200 }),
  ]);
  return {
    games,
    // "Fix IGDB" link: only when there are unmatched games.
    needsMatchCount: needsMatch.length,
    // "Refresh PSN" link: only when the PSN credential needs refreshing.
    psnNeedsRefresh: credential.status === "needs_refresh",
  };
}
