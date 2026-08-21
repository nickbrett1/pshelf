import { describe, it, expect } from "vitest";
import { filterGames, keepIfCancelPsPlus } from "../src/lib/catalog.js";

const games = [
  {
    title: "Bloodborne",
    platform: "PS4",
    ownership_class: "purchased",
    genres: ["Action RPG"],
    retailer: "PSN",
  },
  {
    title: "Returnal",
    platform: "PS5",
    ownership_class: "psplus_extra",
    genres: ["Roguelike", "Shooter"],
    retailer: "PSN",
  },
  {
    title: "Horizon Zero Dawn",
    platform: "PS4",
    ownership_class: "purchased",
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

  it("matches genres and platform", () => {
    expect(filterGames(games, "roguelike").map((g) => g.title)).toEqual([
      "Returnal",
    ]);
    expect(filterGames(games, "ps5").map((g) => g.title)).toEqual(["Returnal"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterGames(games, "zelda")).toHaveLength(0);
  });
});

describe("keepIfCancelPsPlus", () => {
  it("splits owned vs psplus titles", () => {
    const split = keepIfCancelPsPlus(games);
    expect(split.owned).toBe(2);
    expect(split.psplus).toBe(1);
    expect(split.ownedByTitle.map((g) => g.title)).toEqual([
      "Bloodborne",
      "Horizon Zero Dawn",
    ]);
  });
});
