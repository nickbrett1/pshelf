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
 * Filter an in-memory list of games by a free-text query.
 * Case-insensitive match against title, genre, platforms and retailer.
 * Platforms is now the aggregated list (per the Catalog Games Model), so the
 * query matches any of a game's platforms.
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
    const platforms = (game.platforms ?? []).join(" ").toLowerCase();
    const retailer = (game.retailer ?? "").toLowerCase();
    return (
      title.includes(q) ||
      genres.includes(q) ||
      platforms.includes(q) ||
      retailer.includes(q)
    );
  });
}

/**
 * Compute the "keep if I cancel PS+" split from a list of games.
 * Per the Catalog Games Model a game is "kept" iff any of its editions was
 * purchased (`purchased === true`), regardless of other editions being PS+
 * claimed. One card per game, so each game counts once.
 * @param {Array<Object>} games
 * @returns {{owned: number, psplus: number, ownedByTitle: Array<Object>}}
 */
export function keepIfCancelPsPlus(games) {
  const owned = games.filter((g) => g.purchased);
  const psplus = games.filter((g) => !g.purchased);
  return {
    owned: owned.length,
    psplus: psplus.length,
    ownedByTitle: owned,
  };
}

/**
 * Parse an acquisition/purchase date into a sortable number, or null when
 * unparseable/empty.
 *
 * Mailroom stores acquisition dates in several inconsistent formats —
 * ISO ("2026-05-05", used by PSN sync), US month-name ("Nov 27, 2024",
 * "Wednesday, November 27, 2024") and US numeric ("05/08/2021"). String
 * comparison on those is wrong ("Nov" > "July" alphabetically), which broke
 * the "Purchase Date: Newest" sort. So we normalize every format to a comparable
 * YYYYMMDD number (e.g. 20260505), reading local date parts so a UTC-parsed
 * date can't shift a day under a local timezone. A single scale for all
 * formats is essential: an earlier design returned epoch-millis for non-ISO
 * but YYYYMMDD for ISO, so ISO-dated games (PS+ claims like "2026-05-05")
 * always sorted below far older US-format purchases.
 * @param {string|null|undefined} value
 * @returns {number|null}
 */
export function parseAcquisitionDate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // ISO "YYYY-MM-DD" (optionally with a time): read the components directly so
  // a UTC-parsed date can't shift a day under a local timezone.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]);
  }
  // Human-readable / anything else (e.g. "Nov 27, 2024", "05/08/2021",
  // "Wednesday, November 27, 2024"): Date.parse treats a date-only string as
  // local midnight, so reading the local parts reproduces the original date.
  // We fold it into the same YYYYMMDD integer as the ISO branch so every
  // format produces a directly comparable sort key (a per-format scale split —
  // integer YYYYMMDD vs epoch-millis — silently reordered ISO-dated games
  // below much older purchases).
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Format y/m/d as a consistent long-form date, e.g. "November 27, 2024". */
function formatYmd(year, month, day) {
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

/**
 * Normalize an acquisition/purchase date to a single consistent display
 * format: "Month D, YYYY" (e.g. "November 27, 2024"). Mailroom's stored
 * values are inconsistent — sometimes ISO/MM-DD-YYYY, sometimes written out
 * like "Wednesday, November 27, 2024". We collapse all of them to the long
 * form with the day of the week dropped (it isn't useful).
 * Returns null when the value is empty or unparseable (caller hides it).
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function formatAcquisitionDate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // ISO "YYYY-MM-DD" (optionally with a time): read the components directly so
  // a UTC-parsed date can't shift a day under a local timezone.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return formatYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  // Human-readable / anything else (e.g. "Nov 27, 2024",
  // "Wednesday, November 27, 2024"): Date.parse treats a date-only string as
  // local midnight, so reading local parts reproduces the original date.
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return formatYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Coerce a raw catalog value to a finite number, or null when it's absent or
 * unparseable. Used for the numeric sort keys (release date, price).
 *
 * Mailroom stores prices as *currency strings* ("$19.99", per its receipt
 * parsers), so a bare `Number(value)` yields NaN and every price would look
 * "unknown" — which silently disabled the Price sort. Strip currency symbols,
 * thousands separators and whitespace first. "0"/"$0.00" stays 0 (a free game
 * is the cheapest, not "unknown"); genuine non-numbers return null.
 * @param {*} value
 * @returns {number|null}
 */
export function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format mailroom's `release_ts` view column as a display date.
 *
 * Neither `catalog_games` nor `catalog_views` exposes a `year`/`date` column;
 * the only release signal is `release_ts` — IGDB's `first_release_date` as a
 * Unix EPOCH-SECONDS integer (see mailroom db.py) — which carries DAY
 * granularity. Render it in the same long form as acquisition dates
 * ("March 24, 2015"), reading UTC parts so the date can't shift a day under a
 * local timezone. Returns null for missing/zero/unparseable values (the caller
 * hides the line).
 * @param {number|string|null|undefined} value epoch seconds
 * @returns {string|null}
 */
export function formatReleaseDate(value) {
  const ts = parseNumber(value);
  if (ts == null || ts <= 0) return null;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Format an IGDB/HowLongToBeat time-to-beat value (integer SECONDS) as a
 * compact human duration: "12h 30m" / "45m" / "2h". The values are community
 * averages, so the UI prefixes them with "~"; this returns null for
 * missing/zero/unparseable values so the caller can hide the line entirely.
 * (The underlying field is `*_normally`/`*_hastily`/`*_completely` — IGDB's
 * Main + Extra / Main Story / 100% completion estimates.)
 * @param {number|string|null|undefined} value seconds
 * @returns {string|null}
 */
export function formatTimeToBeat(value) {
  const seconds = parseNumber(value);
  if (seconds == null || seconds <= 0) return null;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes <= 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Comparator factory for a numeric field: known values sort first in the
 * requested direction, unknown (null) values always sink to the bottom.
 * Ascending uses `?? Infinity` so a null-release/price game lands last;
 * descending uses `?? -Infinity` for the same reason.
 * Takes a `getter` rather than a field name so there's no dynamic property
 * access (which the security lint flags even for constant keys).
 * @param {(game: Object) => number|null} getter
 * @param {"asc"|"desc"} direction
 * @returns {(a: Object, b: Object) => number}
 */
function byNumber(getter, direction) {
  if (direction === "asc") {
    return (a, b) => (getter(a) ?? Infinity) - (getter(b) ?? Infinity);
  }
  return (a, b) => (getter(b) ?? -Infinity) - (getter(a) ?? -Infinity);
}

/**
 * Sort a list of games by the UI's chosen dimension. Returns a new array (never
 * mutates the input) so it's safe to call on a `$derived` filtered list.
 *
 * Unknown values sort last for every numeric dimension — a game missing a
 * release date or price shouldn't jump to the top of "Newest" or "Cheapest".
 *
 * Supported `sortBy` values:
 *   title          — A→Z
 *   rating         — highest first
 *   purchased      — most recently acquired first, with unreleased
 *                    pre-orders pinned above everything else (a pre-order
 *                    sorts by its fixed purchase date once it releases)
 *   released_desc  — newest release date first
 *   released_asc   — oldest release date first
 *   price_asc      — cheapest first
 *   price_desc     — most expensive first
 *   time_asc       — shortest time to beat first (IGDB "normally" /
 *                    Main + Extra); games with no time-to-beat sort last
 *   time_desc      — longest time to beat first; unknown still sorts last
 * Anything else preserves the incoming order.
 * @param {Array<Object>} games
 * @param {string} sortBy
 * @returns {Array<Object>}
 */
// --- Play state (Played / Unplayed / Completed) ---------------------------
//
// A user-set per-game flag stored in mailroom's `game_play_state` table (keyed
// by a stable game identity) and exposed on the catalog_games view. Every game
// has exactly one of three states; a missing/unknown value (e.g. a store that
// predates the column) is treated as the safe default "unplayed" so the UI and
// the filter degrade gracefully.

/** Canonical play-state values, in display/filter order. */
export const PLAY_STATES = ["unplayed", "played", "completed"];

/**
 * Normalize a raw play_state value to one of PLAY_STATES. Anything missing or
 * unrecognized (null, undefined, a legacy store without the column) becomes
 * "unplayed".
 * @param {*} value
 * @returns {"unplayed"|"played"|"completed"}
 */
export function normalizePlayState(value) {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  return PLAY_STATES.includes(s) ? s : "unplayed";
}

/**
 * Human-readable label for a play state (e.g. "completed" -> "Completed").
 * @param {*} value
 * @returns {string}
 */
export function playStateLabel(value) {
  switch (normalizePlayState(value)) {
    case "played":
      return "Played";
    case "completed":
      return "Completed";
    default:
      return "Unplayed";
  }
}

/**
 * The release timestamp a pre-order should be judged against.
 *
 * The store's expected release date (`preorder_release_ts`) wins when present,
 * because it is the date the buyer is actually waiting for; IGDB's `release_ts`
 * is the fallback so the ordering still works on a store that predates the
 * pre-order columns. Returns null when neither is usable.
 * @param {Object} game
 * @returns {number|null} epoch seconds
 */
export function preorderReleaseTs(game) {
  const storeDate = parseNumber(game?.preorder_release_ts);
  if (storeDate != null && storeDate > 0) return storeDate;
  const igdbDate = parseNumber(game?.release_ts);
  return igdbDate != null && igdbDate > 0 ? igdbDate : null;
}

/**
 * True when a game is a *paid* pre-order whose release is still in the future.
 *
 * Deriving this from dates (rather than trusting mailroom's materialized
 * `is_preorder` flag) is deliberate: the flag is written at sync/catalog-rebuild
 * time, and pshelf caches the catalog on the DB file's mtime. A missed sync
 * would otherwise leave a released game pinned to the top forever. The flag is
 * still used as an *additional* requirement — a PS+ claimed title with a future
 * release date is not a pre-order and must not jump the queue.
 *
 * `now` is injectable so the tests can assert behaviour on both sides of a
 * release date without waiting for it.
 * @param {Object} game mapped catalog row
 * @param {number} [now] epoch milliseconds
 * @returns {boolean}
 */
export function isUnreleasedPreorder(game, now = Date.now()) {
  if (!game?.purchased) return false;
  const releaseTs = preorderReleaseTs(game);
  if (releaseTs == null) return false;
  // release_ts is day-granular (midnight UTC), so a title releasing today is
  // already out — it must sort by its purchase date, not pin to the top.
  if (releaseTs * 1000 <= now) return false;
  // If mailroom says explicitly it IS a pre-order, believe it.
  const flag = game.is_preorder;
  if (flag === 1 || flag === true) return true;
  // A `0` from mailroom is only a veto when there is a purchase date to judge
  // by. mailroom materializes is_preorder from `acquisition_date < release`,
  // so a pre-order whose purchase date failed to land (PSN's entitlement
  // payload has no purchase timestamp — exactly GTA VI's case) gets a default
  // 0 that means "couldn't tell", not "not a pre-order". Fall back to the
  // dates rather than trusting that 0, or the bug this whole change exists to
  // fix comes straight back.
  if ((flag === 0 || flag === false) && parseNumber(game.purchase_date) != null)
    return false;
  return true;
}

export function sortGames(games, sortBy, now = Date.now()) {
  const sorted = [...games];
  switch (sortBy) {
    case "title":
      return sorted.sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? ""),
      );
    case "rating":
      return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "purchased": {
      // Unreleased pre-orders pin to the top: they are the most recent thing
      // you own, and burying them by purchase date is how a brand-new
      // pre-order ended up invisible at the bottom of a 1,000-card list.
      // Among themselves, newest order first, then nearest release date.
      // Everything else — including a pre-order that has since released —
      // sorts by its fixed purchase date, newest first, nulls last.
      const preorders = [];
      const released = [];
      for (const g of sorted) {
        (isUnreleasedPreorder(g, now) ? preorders : released).push(g);
      }
      const byPurchaseDesc = (a, b) =>
        (b.purchase_date ?? -Infinity) - (a.purchase_date ?? -Infinity);
      preorders.sort(
        (a, b) =>
          byPurchaseDesc(a, b) ||
          byNumber(preorderReleaseTs, "asc")(a, b) ||
          (a.title ?? "").localeCompare(b.title ?? ""),
      );
      return [
        ...preorders,
        ...released.sort(
          (a, b) =>
            byPurchaseDesc(a, b) ||
            (a.title ?? "").localeCompare(b.title ?? ""),
        ),
      ];
    }
    case "released_desc":
      return sorted.sort(byNumber((g2) => parseNumber(g2.release_ts), "desc"));
    case "released_asc":
      return sorted.sort(byNumber((g2) => parseNumber(g2.release_ts), "asc"));
    case "price_asc":
      return sorted.sort(byNumber((g2) => parseNumber(g2.price), "asc"));
    case "price_desc":
      return sorted.sort(byNumber((g2) => parseNumber(g2.price), "desc"));
    case "time_asc":
      // Sort on the `normally` estimate (Main + Extra) — the headline
      // completion time. Unknown slots to the bottom like every other numeric
      // dimension, so un-measured games never top "Shortest first".
      return sorted.sort(
        byNumber((g2) => parseNumber(g2.time_to_beat_normally), "asc"),
      );
    case "time_desc":
      // Longest first; unknown (no time-to-beat) still sinks to the bottom.
      return sorted.sort(
        byNumber((g2) => parseNumber(g2.time_to_beat_normally), "desc"),
      );
    default:
      return sorted;
  }
}
