import { loadCatalog } from "$lib/server/catalog-store.js";
import { getNeedsMatch } from "$lib/server/api-client.js";

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const games = loadCatalog();
  // Number of games still needing an IGDB match, used to only show the
  // "Fix IGDB" link when there's actually something to fix. Short, tolerant
  // timeout so a down mailroom API can't stall the catalog page.
  const needsMatch = await getNeedsMatch({ timeout: 1200 });
  return {
    games,
    needsMatchCount: needsMatch.length,
  };
}
