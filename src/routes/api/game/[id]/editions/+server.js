// Lazy-load a single game's editions, fetched only when a card is expanded.
// The catalog page no longer ships every game's `editions` array in the initial
// payload (it was the largest slice of the ~832 KB page); this endpoint serves
// them on demand from the cached catalog store. See memo "Pshelf slow to load".
import { getGameById } from "$lib/server/catalog-store.js";

export function GET({ params }) {
  const game = getGameById(params.id);
  return new Response(JSON.stringify({ editions: game?.editions ?? [] }), {
    headers: { "content-type": "application/json" },
  });
}
