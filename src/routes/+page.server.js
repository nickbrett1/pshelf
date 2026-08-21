import { loadCatalog } from "$lib/server/catalog-store.js";

/** @type {import('./$types').PageServerLoad} */
export function load() {
  return {
    games: loadCatalog(),
  };
}
