// Pure catalog helpers shared by the Pshelf UI. Keeping filtering/sorting logic
// here (out of components) makes it unit-testable and reusable across views.

// Canonical labels for the many spellings mailroom's catalog uses for the same
// platform (e.g. "ps4" vs "playstation 4"). Used to merge duplicate filter
// options and to display a consistent label.
const PLATFORM_ALIASES = {
  ps1: "PS1",
  psx: "PS1",
  "playstation 1": "PS1",
  "playstation one": "PS1",
  ps2: "PS2",
  "playstation 2": "PS2",
  ps3: "PS3",
  "playstation 3": "PS3",
  ps4: "PS4",
  "playstation 4": "PS4",
  "ps 4": "PS4",
  playstation4: "PS4",
  ps5: "PS5",
  "playstation 5": "PS5",
  "ps 5": "PS5",
  playstation5: "PS5",
  playstation: "PlayStation",
  ps: "PlayStation",
  vita: "PS Vita",
  psvita: "PS Vita",
  "ps vita": "PS Vita",
  "playstation vita": "PS Vita",
  psp: "PSP",
  "playstation portable": "PSP",
  pspgo: "PSP",
  "psp go": "PSP",
};

/**
 * Normalize a raw platform string to a canonical display label.
 * "ps4" and "playstation 4" both become "PS4", so filter options and card
 * labels don't show near-duplicates for the same platform.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizePlatform(raw) {
  if (!raw) return raw;
  const key = String(raw).trim().toLowerCase();
  return PLATFORM_ALIASES[key] ?? String(raw).trim();
}

/**
 * Filter an in-memory list of owned games by a free-text query.
 * Case-insensitive match against title, genre, platform and retailer.
 * @param {Array<Object>} games
 * @param {string} query
 * @returns {Array<Object>}
 */
export function filterGames(games, query) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return games;
  return games.filter((game) => {
    const title = (game.title ?? "").toLowerCase();
    const genres = (game.genres ?? []).join(" ").toLowerCase();
    const platform = (game.platform ?? "").toLowerCase();
    const retailer = (game.retailer ?? "").toLowerCase();
    return (
      title.includes(q) ||
      genres.includes(q) ||
      platform.includes(q) ||
      retailer.includes(q)
    );
  });
}

/**
 * Compute the "keep if I cancel PS+" split from a list of games.
 * @param {Array<Object>} games
 * @returns {{owned: number, psplus: number, ownedByTitle: Array<Object>}}
 */
export function keepIfCancelPsPlus(games) {
  const owned = games.filter(
    (g) =>
      g.ownership_class &&
      g.ownership_class !== "psplus_claimed" &&
      g.ownership_class !== "psplus_extra",
  );
  const psplus = games.filter(
    (g) =>
      g.ownership_class === "psplus_claimed" ||
      g.ownership_class === "psplus_extra",
  );
  return {
    owned: owned.length,
    psplus: psplus.length,
    ownedByTitle: owned,
  };
}
