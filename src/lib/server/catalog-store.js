// Read-only access to the shared catalog store for Pshelf.
//
// Pshelf is a read-mostly *consumer* of the mailroom store. It never writes —
// all writes go through mailroom's manual-edit API (single-writer rule). Here
// we read the SQLite `catalog_games` view (one row per logical game, per the
// Catalog Games Model memo) from the read-only /data mount using Node's
// built-in `node:sqlite` (no native deps, present in Node 22+).
//
// If `catalog_games` isn't present yet (pre-migration store) we fall back to
// the legacy per-purchase `catalog_views` view so the UI keeps working during
// rollout.
//
// The data mount path is configurable via CATALOG_DB_PATH (default /data).
// If the DB is not present (e.g. local dev) the store returns an empty list so
// the UI still renders a friendly empty state.

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const DEFAULT_DB_CANDIDATES = ["catalog.db", "mailroom.db", "mailroom.db-wal"];

/**
 * Resolve the absolute path to a catalog SQLite file, preferring a configured
 * DB path and otherwise scanning the data mount for known file names.
 * @returns {string|null}
 */
function resolveDbPath() {
  const dataDir = process.env.CATALOG_DB_PATH ?? "/data";
  if (dataDir.endsWith(".db") && existsSync(dataDir)) return dataDir;

  for (const candidate of DEFAULT_DB_CANDIDATES) {
    const p = path.join(dataDir, candidate);
    // Skip WAL files; the main db file is what we open read-only.
    if (candidate.endsWith(".db") && existsSync(p)) return p;
  }
  return null;
}

/**
 * Map a raw catalog row (unknown DB schema) onto the Pshelf UI contract.
 * Handles both the game-centric `catalog_games` view and the legacy
 * per-purchase `catalog_views` view. Tolerant of missing columns so it
 * degrades gracefully across schema changes.
 * @param {Record<string, any>} row
 * @returns {Object}
 */
export function mapRow(row) {
  return {
    id: row.game_id ?? row.owned_game_id ?? row.id ?? null,
    title: row.title ?? row.name ?? "Untitled",
    // Platforms/formats/ownership are distinct lists on `catalog_games`
    // (`platforms` comma list) but single scalars on legacy `catalog_views`.
    // Normalize both to arrays for the UI.
    platforms: parseList(row.platforms ?? row.platform ?? ""),
    formats: parseList(row.formats ?? row.format ?? ""),
    ownership_classes: parseList(
      row.ownership_classes ?? row.ownership_class ?? "",
    ),
    num_editions: row.num_editions ?? 1,
    // "purchased" on catalog_games = any edition was bought (not just PS+
    // claimed). Legacy rows derive it from ownership_class.
    purchased:
      row.purchased === 1 || row.purchased === true
        ? true
        : row.ownership_class === "purchased",
    retailer: row.retailer ?? null,
    // Covers are cached by mailroom at sync time and served as static files
    // from the shared /data mount (cover_local = '/covers/<id>.jpg',
    // memos/covers-caching-design). Games without a cached cover get the
    // placeholder. No live IGDB dependency.
    cover: row.cover_local ?? null,
    rating: row.rating ?? null,
    year: row.year ?? row.release_year ?? null,
    genres: parseList(row.genres ?? row.genre ?? ""),
    // PSVR2 flag from catalog_games/catalog_views is_psvr2 (IGDB platform
    // 390). A category flag, not a platform — PSVR2 games run on PS5, so the
    // platform list stays PS5.
    psvr2: row.is_psvr2 === 1 || row.is_psvr2 === true,
    // The editions JSON array (one element per owned purchase/edition) on
    // catalog_games. Legacy rows have none.
    editions: parseEditions(row.editions),
    price: row.price ?? null,
    earliest_acquisition: row.earliest_acquisition ?? null,
    provenance: parseList(row.provenance ?? ""),
    igdb_id: row.igdb_id ?? null,
  };
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }
  return [];
}

/** Parse the editions JSON column (array already / JSON string / missing). */
function parseEditions(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** True if a view/table of the given name exists in the DB. */
function hasRelation(db, name) {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE (type='view' OR type='table') AND name=?",
    )
    .get(name);
  return !!row;
}

/**
 * Load all games from catalog_games (read-only), falling back to the legacy
 * catalog_views view when the game-centric view isn't present yet. Returns []
 * if the DB is unavailable.
 * @returns {Array<Object>}
 */
export function loadCatalog() {
  const dbPath = resolveDbPath();
  if (!dbPath) return [];

  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const relation = hasRelation(db, "catalog_games")
      ? "catalog_games"
      : "catalog_views";
    const rows = db.prepare(`SELECT * FROM ${relation}`).all();
    db.close();
    const games = rows.map(mapRow);
    // Svelte 5's keyed {#each} throws on duplicate keys (each_key_duplicate).
    // Many rows have no usable id and titles repeat, so the natural key
    // (game.id ?? game.title) collides and breaks hydration of the grid.
    // Give every row a unique, stable key computed once at load time.
    return games.map((g, i) => ({ ...g, key: `${g.id ?? g.title}__${i}` }));
  } catch (err) {
    console.error(
      `[pshelf] failed to read catalog from ${dbPath}:`,
      err.message,
    );
    return [];
  }
}
