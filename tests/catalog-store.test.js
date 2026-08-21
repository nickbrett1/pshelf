import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  loadCatalog,
  mapRow,
  normalizeCover,
  coverPath,
} from "../src/lib/server/catalog-store.js";

const ORIGINAL_PATH = process.env.CATALOG_DB_PATH;

let dir;
let dbPath;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "pshelf-"));
  dbPath = path.join(dir, "catalog.db");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  if (ORIGINAL_PATH === undefined) {
    delete process.env.CATALOG_DB_PATH;
  } else {
    process.env.CATALOG_DB_PATH = ORIGINAL_PATH;
  }
});

beforeEach(() => {
  process.env.CATALOG_DB_PATH = dbPath;
});

function seedDb() {
  rmSync(dbPath, { force: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
		CREATE TABLE catalog_views (
			owned_game_id INTEGER,
			title TEXT,
			platform TEXT,
			format TEXT,
			ownership_class TEXT,
			retailer TEXT,
			cover_url TEXT,
			rating REAL,
			year INTEGER,
			genres TEXT
		);
		INSERT INTO catalog_views VALUES
			(1, 'Bloodborne', 'PS4', 'digital', 'purchased', 'PSN', 'http://img/bb.jpg', 92, 2015, 'Action RPG, Souls'),
			(2, 'Returnal', 'PS5', 'digital', 'psplus_extra', 'PSN', 'http://img/rt.jpg', 88, 2021, 'Roguelike');
	`);
  db.close();
}

describe("loadCatalog", () => {
  it("reads and maps catalog_views from the configured DB", () => {
    seedDb();
    const games = loadCatalog();
    expect(games).toHaveLength(2);
    expect(games[0].title).toBe("Bloodborne");
    expect(games[0].genres).toEqual(["Action RPG", "Souls"]);
    expect(games[1].ownership_class).toBe("psplus_extra");
  });

  it("returns [] when the DB file does not exist", () => {
    process.env.CATALOG_DB_PATH = path.join(dir, "missing.db");
    expect(loadCatalog()).toEqual([]);
  });
});

describe("normalizeCover", () => {
  it("upgrades protocol-relative and http URLs to https", () => {
    expect(normalizeCover("//images.igdb.com/igdb/x.jpg")).toBe(
      "https://images.igdb.com/igdb/x.jpg",
    );
    expect(normalizeCover("http://images.igdb.com/x.jpg")).toBe(
      "https://images.igdb.com/x.jpg",
    );
    expect(normalizeCover("https://images.igdb.com/x.jpg")).toBe(
      "https://images.igdb.com/x.jpg",
    );
  });

  it("returns null for empty/invalid covers", () => {
    expect(normalizeCover("")).toBeNull();
    expect(normalizeCover(null)).toBeNull();
    expect(normalizeCover(undefined)).toBeNull();
    expect(normalizeCover(123)).toBeNull();
  });
});

describe("coverPath", () => {
  it("rewrites IGDB covers to same-origin proxy paths", () => {
    expect(
      coverPath("https://images.igdb.com/igdb/image/upload/t_thumb/co1.jpg"),
    ).toBe("/img/igdb/image/upload/t_thumb/co1.jpg");
    expect(
      coverPath("//images.igdb.com/igdb/image/upload/t_thumb/co2.jpg"),
    ).toBe("/img/igdb/image/upload/t_thumb/co2.jpg");
  });

  it("leaves non-IGDB covers as absolute URLs and nulls empties", () => {
    expect(coverPath("http://cdn.example.com/x.jpg")).toBe(
      "https://cdn.example.com/x.jpg",
    );
    expect(coverPath("")).toBeNull();
    expect(coverPath(null)).toBeNull();
  });
});

describe("mapRow", () => {
  it("maps a full row to the UI contract", () => {
    const row = {
      owned_game_id: 42,
      title: "Horizon",
      platform: "PS4",
      format: "physical",
      ownership_class: "purchased",
      retailer: "GameStop",
      cover_url: "//img/h.jpg",
      rating: 89,
      year: 2017,
      genres: "Action RPG",
    };
    expect(mapRow(row)).toEqual({
      id: 42,
      title: "Horizon",
      platform: "PS4",
      format: "physical",
      ownership_class: "purchased",
      retailer: "GameStop",
      cover: "https://img/h.jpg",
      rating: 89,
      year: 2017,
      genres: ["Action RPG"],
    });
  });

  it("falls back gracefully when columns are missing", () => {
    const mapped = mapRow({ title: "Untitled" });
    expect(mapped.platform).toBe("Unknown");
    expect(mapped.ownership_class).toBe("unknown");
    expect(mapped.genres).toEqual([]);
    expect(mapped.id).toBeNull();
  });
});
