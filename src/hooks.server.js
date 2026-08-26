// Runs once when the server starts (SvelteKit `init` hook). Warms the
// in-process catalog cache so the *first* page load doesn't pay the full
// ~244 MB DB scan — it serves from memory instead. See loadCatalog in
// catalog-store.js (memo "Pshelf slow to load").
import { loadCatalog } from "$lib/server/catalog-store.js";

/** @type {import('@sveltejs/kit').Init} */
export function init() {
  try {
    const count = loadCatalog().length;
    console.log(`[pshelf] catalog cache warmed (${count} games)`);
  } catch (err) {
    // Never block startup on a cache warm — the first request will fall back
    // to a cold load (and cache) as before.
    console.error("[pshelf] failed to warm catalog cache:", err);
  }
}
