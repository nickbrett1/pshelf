// Diagnostic endpoint: report exactly which catalog DB Pshelf is reading.
// Use this when the UI looks stale — it shows the resolved DB path, file
// size/mtime, whether a -wal is present, and what's on the /data mount, so we
// can confirm Pshelf is pointed at the same copy mailroom writes to.
import { catalogSourceInfo } from "$lib/server/catalog-store.js";

export function GET() {
  return new Response(JSON.stringify(catalogSourceInfo(), null, 2), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
