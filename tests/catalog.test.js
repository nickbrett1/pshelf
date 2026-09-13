import { describe, it, expect } from "vitest";
import {
  filterGames,
  formatAcquisitionDate,
  keepIfCancelPsPlus,
  normalizePlatform,
  parseAcquisitionDate,
  sortGames,
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

describe("parseAcquisitionDate", () => {
  it("parses ISO dates to a TZ-independent sortable number", () => {
    expect(parseAcquisitionDate("2024-11-27")).toBe(20241127);
    expect(parseAcquisitionDate("2026-07-26")).toBe(20260726);
    expect(parseAcquisitionDate("2024-11-27 09:30:00")).toBe(20241127);
  });

  it("parses human-readable US month dates (mailroom format)", () => {
    const nov = parseAcquisitionDate("Nov 27, 2024");
    const jul = parseAcquisitionDate("July 26, 2026");
    expect(nov).not.toBeNull();
    expect(jul).not.toBeNull();
    // July 2026 is after Nov 2024 regardless of string alphabetics.
    expect(jul).toBeGreaterThan(nov);
  });

  it("uses ONE comparable scale across ISO, numeric and written formats", () => {
    // PSN sync stores ISO; manual/retail entries are US numeric or written.
    // These must fold to the same YYYYMMDD so ISO-dated games (e.g. a
    // 2026-05-05 PS+ claim) don't sort below much older purchases.
    expect(parseAcquisitionDate("2026-05-05")).toBe(
      parseAcquisitionDate("05/05/2026"),
    );
    expect(parseAcquisitionDate("2026-05-05")).toBe(
      parseAcquisitionDate("May 5, 2026"),
    );
    // A May 2026 claim is newer than a 2021 purchase in ANY source format.
    expect(parseAcquisitionDate("2026-05-05")).toBeGreaterThan(
      parseAcquisitionDate("05/08/2021"),
    );
  });

  it("returns null for empty, null and garbage values", () => {
    expect(parseAcquisitionDate(null)).toBeNull();
    expect(parseAcquisitionDate(undefined)).toBeNull();
    expect(parseAcquisitionDate("")).toBeNull();
    expect(parseAcquisitionDate("  ")).toBeNull();
    expect(parseAcquisitionDate("not a date")).toBeNull();
  });
});

describe("formatAcquisitionDate", () => {
  it("formats ISO dates as Month D, YYYY", () => {
    expect(formatAcquisitionDate("2024-11-27")).toBe("November 27, 2024");
    expect(formatAcquisitionDate("2024-11-27 09:30:00")).toBe(
      "November 27, 2024",
    );
    expect(formatAcquisitionDate("2026-07-26")).toBe("July 26, 2026");
  });

  it("formats written-out dates, dropping the day of the week", () => {
    expect(formatAcquisitionDate("Wednesday, November 27, 2024")).toBe(
      "November 27, 2024",
    );
    expect(formatAcquisitionDate("Nov 27, 2024")).toBe("November 27, 2024");
    expect(formatAcquisitionDate("July 26, 2026")).toBe("July 26, 2026");
  });

  it("formats MM/DD/YYYY dates", () => {
    expect(formatAcquisitionDate("11/27/2024")).toBe("November 27, 2024");
  });

  it("returns null for empty and unparseable values", () => {
    expect(formatAcquisitionDate(null)).toBeNull();
    expect(formatAcquisitionDate(undefined)).toBeNull();
    expect(formatAcquisitionDate("")).toBeNull();
    expect(formatAcquisitionDate("not a date")).toBeNull();
  });
});

describe("sortGames", () => {
  const titles = (games) => games.map((g) => g.title);
  const g = (title, extra = {}) => ({ title, ...extra });

  it("sorts by title A→Z", () => {
    const input = [g("Returnal"), g("Bloodborne"), g("Astro Bot")];
    expect(titles(sortGames(input, "title"))).toEqual([
      "Astro Bot",
      "Bloodborne",
      "Returnal",
    ]);
  });

  it("sorts by rating, highest first, missing rating last", () => {
    const input = [
      g("High", { rating: 92 }),
      g("None"),
      g("Mid", { rating: 80 }),
    ];
    expect(titles(sortGames(input, "rating"))).toEqual(["High", "Mid", "None"]);
  });

  it("does not mutate the input array", () => {
    const input = [g("B", { year: 2001 }), g("A", { year: 1999 })];
    const snapshot = [...input];
    sortGames(input, "released_asc");
    expect(input).toEqual(snapshot);
  });

  describe("release year", () => {
    const input = [
      g("Old", { year: 1999 }),
      g("Unknown"),
      g("New", { year: 2024 }),
      g("Mid", { year: 2015 }),
    ];

    it("newest first, unknown last", () => {
      expect(titles(sortGames(input, "released_desc"))).toEqual([
        "New",
        "Mid",
        "Old",
        "Unknown",
      ]);
    });

    it("oldest first, unknown last", () => {
      expect(titles(sortGames(input, "released_asc"))).toEqual([
        "Old",
        "Mid",
        "New",
        "Unknown",
      ]);
    });

    it("treats an empty-string year as unknown (sorts last)", () => {
      const withEmpty = [g("Blank", { year: "" }), g("Real", { year: 2010 })];
      expect(titles(sortGames(withEmpty, "released_desc"))).toEqual([
        "Real",
        "Blank",
      ]);
    });
  });

  describe("price", () => {
    const input = [
      g("Mid", { price: 19.99 }),
      g("Unknown"),
      g("Free", { price: 0 }),
      g("Pricey", { price: 69.99 }),
    ];

    it("cheapest first, unknown last, free beats undefined", () => {
      expect(titles(sortGames(input, "price_asc"))).toEqual([
        "Free",
        "Mid",
        "Pricey",
        "Unknown",
      ]);
    });

    it("most expensive first, unknown last", () => {
      expect(titles(sortGames(input, "price_desc"))).toEqual([
        "Pricey",
        "Mid",
        "Free",
        "Unknown",
      ]);
    });

    it("coerces numeric strings (SQLite may hand back text)", () => {
      const withString = [g("Str", { price: "5.00" }), g("Num", { price: 10 })];
      expect(titles(sortGames(withString, "price_asc"))).toEqual([
        "Str",
        "Num",
      ]);
    });
  });

  it("preserves incoming order for an unknown dimension", () => {
    const input = [g("B"), g("A")];
    expect(titles(sortGames(input, "nonsense"))).toEqual(["B", "A"]);
  });
});
