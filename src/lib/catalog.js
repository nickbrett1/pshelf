// Pure catalog helpers shared by the Pshelf UI. Keeping filtering/sorting logic
// here (out of components) makes it unit-testable and reusable across views.

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
