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
    // Inspect the underlying tables to see whether IGDB metadata / cover cache
    // data actually exists (game_metadata payloads, game_covers rows).
    let gameMetadata = null;
    let gameCovers = null;
    try {
      gameMetadata = {
        rows: db.prepare("SELECT COUNT(*) AS n FROM game_metadata").get().n,
        withCoverUrl: db
          .prepare(
            "SELECT COUNT(*) AS n FROM game_metadata WHERE json_extract(payload, '$.cover.url') IS NOT NULL",
          )
          .get().n,
      };
    } catch {
      gameMetadata = { error: "table missing" };
    }
    try {
      gameCovers = {
        rows: db.prepare("SELECT COUNT(*) AS n FROM game_covers").get().n,
        withLocalPath: db
          .prepare(
            "SELECT COUNT(*) AS n FROM game_covers WHERE local_path IS NOT NULL",
          )
          .get().n,
      };
    } catch {
      gameCovers = { error: "table missing" };
    }
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
        gameMetadata,
        gameCovers,
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
