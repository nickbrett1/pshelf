import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  loadCatalog,
  mapRow,
  dedupeGames,
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

function seedGamesDb() {
  rmSync(dbPath, { force: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
		CREATE VIEW catalog_games AS
		SELECT
			1 AS game_id,
			'Bloodborne' AS title,
			'PS4' AS platform,
			'PS4' AS platforms,
			'digital' AS formats,
			'purchased' AS ownership_classes,
			1 AS num_editions,
			1 AS purchased,
			'PSN' AS retailer,
			'/covers/bb.jpg' AS cover_local,
			92 AS rating,
			2015 AS year,
			'Action RPG, Souls' AS genres,
			0 AS is_psvr2,
			'[{"id":1,"title":"Bloodborne","platform":"PS4","format":"digital","ownership_class":"purchased","price":19.99,"acquisition_date":"2015-03-24"}]' AS editions;
	`);
  db.close();
}

function seedViewsDb() {
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
  it("reads and maps catalog_games (one card per logical game)", () => {
    seedGamesDb();
    const games = loadCatalog();
    expect(games).toHaveLength(1);
    expect(games[0].title).toBe("Bloodborne");
    expect(games[0].id).toBe(1);
    expect(games[0].platforms).toEqual(["PS4"]);
    expect(games[0].genres).toEqual(["Action RPG", "Souls"]);
    expect(games[0].purchased).toBe(true);
    expect(games[0].num_editions).toBe(1);
    expect(games[0].editions).toHaveLength(1);
    expect(games[0].editions[0].ownership_class).toBe("purchased");
  });

  it("falls back to catalog_views when catalog_games is absent", () => {
    seedViewsDb();
    const games = loadCatalog();
    expect(games).toHaveLength(2);
    expect(games[0].title).toBe("Bloodborne");
    expect(games[0].genres).toEqual(["Action RPG", "Souls"]);
    expect(games[0].platforms).toEqual(["PS4"]);
    expect(games[1].purchased).toBe(false);
  });

  it("returns [] when the DB file does not exist", () => {
    process.env.CATALOG_DB_PATH = path.join(dir, "missing.db");
    expect(loadCatalog()).toEqual([]);
  });
});

describe("mapRow", () => {
  it("maps a catalog_games row to the UI contract", () => {
    const row = {
      game_id: 7,
      title: "Alien Isolation",
      platforms: "PS4,PS5",
      formats: "digital,physical",
      ownership_classes: "purchased",
      num_editions: 2,
      purchased: 1,
      retailer: "PSN",
      cover_local: "/covers/ai.jpg",
      rating: 90,
      year: 2014,
      genres: "Survival Horror",
      is_psvr2: 0,
      editions: JSON.stringify([
        {
          id: 7,
          title: "Alien Isolation",
          platform: "PS4",
          format: "digital",
          ownership_class: "purchased",
          price: 29.99,
          acquisition_date: "2014-10-07",
        },
      ]),
    };
    expect(mapRow(row)).toEqual({
      id: 7,
      title: "Alien Isolation",
      platforms: ["PS4", "PS5"],
      formats: ["digital", "physical"],
      ownership_classes: ["purchased"],
      num_editions: 2,
      purchased: true,
      retailer: "PSN",
      cover: "/covers/ai.jpg",
      rating: 90,
      year: 2014,
      genres: ["Survival Horror"],
      psvr2: false,
      editions: [
        {
          id: 7,
          title: "Alien Isolation",
          platform: "PS4",
          format: "digital",
          ownership_class: "purchased",
          price: 29.99,
          acquisition_date: "2014-10-07",
        },
      ],
      price: null,
      earliest_acquisition: null,
      provenance: [],
      igdb_id: null,
    });
  });

  it("parses a legacy catalog_views row into the same contract", () => {
    const row = {
      owned_game_id: 42,
      title: "Horizon",
      platform: "PS4",
      format: "physical",
      ownership_class: "purchased",
      retailer: "GameStop",
      cover_local: "/covers/h.jpg",
      rating: 89,
      year: 2017,
      genres: "Action RPG",
    };
    expect(mapRow(row)).toEqual({
      id: 42,
      title: "Horizon",
      platforms: ["PS4"],
      formats: ["physical"],
      ownership_classes: ["purchased"],
      num_editions: 1,
      purchased: true,
      retailer: "GameStop",
      cover: "/covers/h.jpg",
      rating: 89,
      year: 2017,
      genres: ["Action RPG"],
      psvr2: false,
      editions: [],
      price: null,
      earliest_acquisition: null,
      provenance: [],
      igdb_id: null,
    });
  });

  it("uses cover_local for the cover and nulls it when absent", () => {
    expect(
      mapRow({ title: "Bloodborne", cover_local: "/covers/co1.jpg" }).cover,
    ).toBe("/covers/co1.jpg");
    // no cached cover -> placeholder (no live IGDB dependency)
    expect(mapRow({ title: "B", cover_url: "//img/x.jpg" }).cover).toBeNull();
  });

  it("maps the is_psvr2 flag to a boolean", () => {
    expect(mapRow({ title: "Horizon VR", is_psvr2: 1 }).psvr2).toBe(true);
    expect(mapRow({ title: "Horizon VR", is_psvr2: true }).psvr2).toBe(true);
    expect(mapRow({ title: "Skyrim", is_psvr2: 0 }).psvr2).toBe(false);
    expect(mapRow({ title: "Skyrim", is_psvr2: null }).psvr2).toBe(false);
    expect(mapRow({ title: "Skyrim" }).psvr2).toBe(false);
  });

  it("parses the editions JSON column and tolerates bad/missing JSON", () => {
    expect(
      mapRow({ title: "Slay the Spire", editions: "[1,2]" }).editions,
    ).toEqual([1, 2]);
    expect(mapRow({ title: "Bad", editions: "not json" }).editions).toEqual([]);
    expect(mapRow({ title: "None" }).editions).toEqual([]);
    expect(mapRow({ title: "Arr", editions: [{ id: 1 }] }).editions).toEqual([
      { id: 1 },
    ]);
  });

  it("falls back gracefully when columns are missing", () => {
    const mapped = mapRow({ title: "Untitled" });
    expect(mapped.platforms).toEqual([]);
    expect(mapped.formats).toEqual([]);
    expect(mapped.ownership_classes).toEqual([]);
    expect(mapped.genres).toEqual([]);
    expect(mapped.id).toBeNull();
  });
});

describe("dedupeGames", () => {
  it("keeps one card per logical game when the view emits duplicate rows", () => {
    // Mirrors the mailroom join artifact: same game (game_id + igdb_id)
    // emitted twice. The duplicate row must not render as a second card.
    const games = [
      {
        id: 1968,
        title: "Rayman Legends",
        igdb_id: 1968,
        platforms: ["PS4"],
        purchased: true,
      },
      {
        id: 1968,
        title: "Rayman Legends",
        igdb_id: 1968,
        platforms: ["PS4"],
        purchased: true,
      },
      {
        id: 5,
        title: "Bloodborne",
        igdb_id: 7334,
        platforms: ["PS4"],
        purchased: true,
      },
    ];
    const deduped = dedupeGames(games);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((g) => g.title)).toEqual([
      "Rayman Legends",
      "Bloodborne",
    ]);
  });

  it("dedupes by igdb_id when game_id is missing", () => {
    const games = [
      { id: null, title: "Returnal", igdb_id: 123, platforms: ["PS5"] },
      { id: null, title: "Returnal", igdb_id: 123, platforms: ["PS5"] },
    ];
    expect(dedupeGames(games)).toHaveLength(1);
  });

  it("falls back to title when there is no id or igdb_id", () => {
    const untitled = "Untitled";
    const games = [
      { id: null, title: untitled },
      { id: null, title: untitled },
      { id: null, title: "Other" },
    ];
    const deduped = dedupeGames(games);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((g) => g.title)).toEqual([untitled, "Other"]);
  });

  it("keeps distinct games that share neither id nor title", () => {
    const games = [
      { id: 1, title: "A", igdb_id: 10 },
      { id: 2, title: "B", igdb_id: 20 },
    ];
    expect(dedupeGames(games)).toHaveLength(2);
  });
});
