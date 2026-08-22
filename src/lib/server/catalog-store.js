// Read-only access to the shared catalog_views store for Pshelf.
//
// Pshelf is a read-mostly *consumer* of the mailroom store. It never writes —
// all writes go through mailroom's manual-edit API (single-writer rule). Here
// we read the SQLite `catalog_views` view from the read-only /data mount using
// Node's built-in `node:sqlite` (no native deps, present in Node 22+).
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
/**
 * Map a raw catalog_views row (unknown DB schema) onto the Pshelf UI contract.
 * Tolerant of missing columns so it degrades gracefully across schema changes.
 * @param {Record<string, any>} row
 * @returns {Object}
 */
export function mapRow(row) {
  return {
    id: row.owned_game_id ?? row.id ?? null,
    title: row.title ?? row.name ?? "Untitled",
    platform: row.platform ?? "Unknown",
    format: row.format ?? row.media_type ?? "unknown",
    ownership_class: row.ownership_class ?? "unknown",
    retailer: row.retailer ?? null,
    // Covers are cached by mailroom at sync time and served as static files
    // from the shared /data mount (cover_local = '/covers/<id>.jpg',
    // memos/covers-caching-design). Games without a cached cover get the
    // placeholder. No live IGDB dependency.
    cover: row.cover_local ?? null,
    rating: row.rating ?? null,
    year: row.year ?? row.release_year ?? null,
    genres: parseList(row.genres ?? row.genre ?? ""),
    // PSVR2 flag from catalog_views.is_psvr2 (IGDB platform 390). A category
    // flag, not a platform — PSVR2 games run on PS5, so platform stays PS5.
    psvr2: row.is_psvr2 === 1 || row.is_psvr2 === true,
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

/**
 * Load all owned games from catalog_views (read-only). Returns [] if the DB
 * is unavailable.
 * @returns {Array<Object>}
 */
export function loadCatalog() {
  const dbPath = resolveDbPath();
  if (!dbPath) return [];

  try {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare("SELECT * FROM catalog_views").all();
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
