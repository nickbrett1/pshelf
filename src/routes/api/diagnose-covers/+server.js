// Diagnostic endpoint: reports which DB pshelf reads and whether IGDB-derived
// cover fields (cover_local / cover_url) are populated. Used to debug cover
// images not loading (e.g. a stale catalog.db shadowing mailroom.db).

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolveDbPath } from "$lib/server/catalog-store.js";

/** @type {import('./$types').RequestHandler} */
export function GET() {
  const dbPath = resolveDbPath();
  if (!dbPath || !existsSync(dbPath)) {
    return new Response(JSON.stringify({ dbPath: null, error: "no db" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const cols = db
      .prepare("PRAGMA table_info(catalog_views)")
      .all()
      .map((c) => c.name);
    const total = db.prepare("SELECT COUNT(*) AS n FROM catalog_views").get().n;
    const hasCoverLocal = cols.includes("cover_local");
    const coverLocalSet = hasCoverLocal
      ? db
          .prepare(
            "SELECT COUNT(*) AS n FROM catalog_views WHERE cover_local IS NOT NULL",
          )
          .get().n
      : null;
    const hasCoverUrl = cols.includes("cover_url");
    const coverUrlSet = hasCoverUrl
      ? db
          .prepare(
            "SELECT COUNT(*) AS n FROM catalog_views WHERE cover_url IS NOT NULL",
          )
          .get().n
      : null;
    const samples = hasCoverLocal
      ? db
          .prepare(
            "SELECT title, cover_local FROM catalog_views WHERE cover_local IS NOT NULL LIMIT 3",
          )
          .all()
      : [];
    db.close();
    return new Response(
      JSON.stringify({
        dbPath,
        cols,
        total,
        hasCoverLocal,
        coverLocalSet,
        hasCoverUrl,
        coverUrlSet,
        samples,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ dbPath, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
