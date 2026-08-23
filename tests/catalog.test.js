import { describe, it, expect } from "vitest";
import {
  filterGames,
  keepIfCancelPsPlus,
  normalizePlatform,
} from "../src/lib/catalog.js";

const games = [
  {
    title: "Bloodborne",
    platforms: ["PS4"],
    purchased: true,
    genres: ["Action RPG"],
    retailer: "PSN",
  },
  {
    title: "Returnal",
    platforms: ["PS5"],
    purchased: false,
    genres: ["Roguelike", "Shooter"],
    retailer: "PSN",
  },
  {
    title: "Horizon Zero Dawn",
    platforms: ["PS4"],
    purchased: true,
    genres: ["Action RPG"],
    retailer: "PSN",
  },
];

describe("filterGames", () => {
  it("returns all games for an empty query", () => {
    expect(filterGames(games, "")).toHaveLength(3);
    expect(filterGames(games, "   ")).toHaveLength(3);
  });

  it("matches title case-insensitively", () => {
    expect(filterGames(games, "bloodborne").map((g) => g.title)).toEqual([
      "Bloodborne",
    ]);
    expect(filterGames(games, "RETURNAL").map((g) => g.title)).toEqual([
      "Returnal",
    ]);
  });

  it("matches genres and any platform in the aggregated list", () => {
    expect(filterGames(games, "roguelike").map((g) => g.title)).toEqual([
      "Returnal",
    ]);
    expect(filterGames(games, "ps5").map((g) => g.title)).toEqual(["Returnal"]);
  });

  it("matches a multi-platform game by any of its platforms", () => {
    const multi = [
      {
        title: "Alien Isolation",
        platforms: ["PS4", "PS5"],
        purchased: true,
        genres: [],
        retailer: null,
      },
    ];
    expect(filterGames(multi, "ps5").map((g) => g.title)).toEqual([
      "Alien Isolation",
    ]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterGames(games, "zelda")).toHaveLength(0);
  });
});

describe("keepIfCancelPsPlus", () => {
  it("splits kept (purchased) vs lost (PS+) games, one card each", () => {
    const split = keepIfCancelPsPlus(games);
    expect(split.owned).toBe(2);
    expect(split.psplus).toBe(1);
    expect(split.ownedByTitle.map((g) => g.title)).toEqual([
      "Bloodborne",
      "Horizon Zero Dawn",
    ]);
  });

  it("counts a game as kept when any edition was purchased", () => {
    const mixed = [
      {
        title: "Slay the Spire",
        platforms: ["PS5"],
        purchased: true,
        genres: [],
        retailer: null,
      },
      {
        title: "Arcade Paradise",
        platforms: ["PS5"],
        purchased: false,
        genres: [],
        retailer: null,
      },
    ];
    const split = keepIfCancelPsPlus(mixed);
    expect(split.owned).toBe(1);
    expect(split.psplus).toBe(1);
  });
});

describe("normalizePlatform", () => {
  it("merges the common spellings of each console", () => {
    expect(normalizePlatform("ps4")).toBe("PS4");
    expect(normalizePlatform("playstation 4")).toBe("PS4");
    expect(normalizePlatform("PS4")).toBe("PS4");
    expect(normalizePlatform("playstation4")).toBe("PS4");
    expect(normalizePlatform("ps5")).toBe("PS5");
    expect(normalizePlatform("playstation 5")).toBe("PS5");
    expect(normalizePlatform("playstation 3")).toBe("PS3");
  });

  it("handles handhelds and generic platform", () => {
    expect(normalizePlatform("ps vita")).toBe("PS Vita");
    expect(normalizePlatform("vita")).toBe("PS Vita");
    expect(normalizePlatform("psp")).toBe("PSP");
    expect(normalizePlatform("playstation")).toBe("PlayStation");
  });

  it("passes through unknown and null values", () => {
    expect(normalizePlatform("Switch")).toBe("Switch");
    expect(normalizePlatform(null)).toBeNull();
    expect(normalizePlatform(undefined)).toBeUndefined();
    expect(normalizePlatform("")).toBe("");
  });
});
