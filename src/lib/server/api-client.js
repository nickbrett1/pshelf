// Thin, read-mostly client for mailroom's manual API (:3004) and the IGDB MCP
// (igdb-mcp:8765). All calls go server-side (pshelf proxies them) so API
// details stay out of the browser and we avoid CORS. Endpoints and payload
// shapes come from the mailroom contract (see the catalog-site memo / mailroom
// repo). The IGDB search route is POST <IGDB_API_URL>/igdb/search.

const MANUAL_API = (process.env.MANUAL_API_URL || "http://nas:3004").replace(
  /\/$/,
  "",
);
const IGDB_API = (process.env.IGDB_API_URL || "http://igdb-mcp:8765").replace(
  /\/$/,
  "",
);

/**
 * Tolerant parser for the /manual/needs-match response.
 * Handles both `{items:[...]}` / `{games:[...]}` wrappers and a bare array.
 * @param {unknown} json
 * @returns {Array<Object>}
 */
export function parseNeedsMatch(json) {
  const list = Array.isArray(json) ? json : (json?.items ?? json?.games ?? []);
  return list
    .map((g) => ({
      id: g.owned_game_id ?? g.id ?? null,
      title: g.title ?? g.name ?? "Untitled",
      platform: g.platform ?? null,
      format: g.format ?? null,
    }))
    .filter((g) => g.id != null);
}

/**
 * Tolerant parser for IGDB search candidates.
 * @param {unknown} json
 * @returns {Array<Object>}
 */
export function parseIgdbCandidates(json) {
  const list = Array.isArray(json)
    ? json
    : (json?.results ?? json?.items ?? json?.games ?? []);
  return list
    .map((g) => ({
      igdb_id: g.id ?? g.igdb_id ?? null,
      name: g.name ?? g.title ?? "Untitled",
      year: g.year ?? g.first_release_date?.toString().slice(0, 4) ?? null,
      cover: g.cover ?? g.cover_url ?? null,
    }))
    .filter((g) => g.igdb_id != null);
}

/** @returns {Promise<Array<Object>>} list of unmatched owned games */
export async function getNeedsMatch({ timeout = 8000 } = {}) {
  try {
    const res = await fetch(`${MANUAL_API}/manual/needs-match`, {
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return [];
    return parseNeedsMatch(await res.json());
  } catch (err) {
    console.error("[pshelf] needs-match unavailable:", err.message);
    return [];
  }
}

/** @param {string} title @returns {Promise<Array<Object>>} IGDB candidates */
export async function igdbSearch(title) {
  try {
    const res = await fetch(`${IGDB_API}/igdb/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity: "game", name: title, query: title }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return parseIgdbCandidates(await res.json());
  } catch (err) {
    console.error("[pshelf] igdb search unavailable:", err.message);
    return [];
  }
}

/**
 * Apply an IGDB match via the manual API (audited in review_queue).
 * @param {number|string} ownedGameId
 * @param {number|string} igdbId
 * @param {string|null} note
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
/**
 * Flag a non-game reject (demo/OST/artbook/cable) for exclusion.
 * Endpoint is slated for mailroom's manual API; if it's not implemented yet
 * the call fails gracefully so the UI can still capture the intent.
 * @param {number|string} ownedGameId
 * @param {string|null} note
 * @returns {Promise<{ok: boolean, error?: string, unsupported?: boolean}>}
 */
export async function excludeNonGame(ownedGameId, note = null) {
  try {
    const body = { owned_game_id: ownedGameId, exclude: true };
    if (note) body.note = note;
    const res = await fetch(`${MANUAL_API}/manual/needs-match/exclude`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404)
      return {
        ok: false,
        unsupported: true,
        error: "exclude endpoint not implemented",
      };
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `manual API ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** @returns {Promise<{status: string, last_success: string|null, last_error: string|null, expires_at: string|null}>} */
export async function getPsnCredential() {
  const fallback = {
    status: "needs_refresh",
    last_success: null,
    last_error: null,
    expires_at: null,
  };
  try {
    const res = await fetch(`${MANUAL_API}/manual/psn-credential`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ...fallback, last_error: `manual API ${res.status}` };
    return { ...fallback, ...(await res.json()) };
  } catch (err) {
    return { ...fallback, last_error: err.message };
  }
}

/**
 * Submit a fresh NPSSO to refresh the PSN credential.
 * @param {string} npsso
 * @returns {Promise<{ok: boolean, error?: string, status?: string}>}
 */
export async function submitPsnCredential(npsso) {
  try {
    const res = await fetch(`${MANUAL_API}/manual/psn-credential`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ npsso }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text();
      let detail = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        detail = j.detail ?? detail;
      } catch {
        // not JSON
      }
      return { ok: false, error: detail };
    }
    const data = await res.json();
    return { ok: true, status: data?.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function applyIgdbMatch(ownedGameId, igdbId, note = null) {
  try {
    const body = { owned_game_id: ownedGameId, igdb_id: igdbId };
    if (note) body.note = note;
    const res = await fetch(`${MANUAL_API}/manual/igdb-match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `manual API ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
