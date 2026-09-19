// Server-side proxy for editing a game's play state. The browser never talks to
// mailroom's manual API directly — all writes go through the server (single
// writer rule; avoids CORS and keeps API details server-side).
//
// POST /api/game/play-state
//   body: { state: 'played'|'unplayed'|'completed',
//           igdb_id?: number|null, normalized_title?: string|null }
// The game is identified by igdb_id when present, else normalized_title.
import { json } from "@sveltejs/kit";
import { PLAY_STATES } from "$lib/catalog.js";
import { setPlayState } from "$lib/server/api-client.js";

export async function POST({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const state =
    typeof body?.state === "string" ? body.state.trim().toLowerCase() : "";
  if (!PLAY_STATES.includes(state)) {
    return json(
      { ok: false, error: `state must be one of ${PLAY_STATES.join(", ")}` },
      { status: 400 },
    );
  }

  const igdbId = Number.isInteger(body?.igdb_id) ? body.igdb_id : null;
  const normalizedTitle =
    typeof body?.normalized_title === "string" && body.normalized_title.trim()
      ? body.normalized_title.trim()
      : null;
  if (igdbId == null && !normalizedTitle) {
    return json(
      { ok: false, error: "missing igdb_id or normalized_title" },
      { status: 400 },
    );
  }

  const result = await setPlayState({
    igdb_id: igdbId,
    normalized_title: normalizedTitle,
    state,
  });
  return json(result, { status: result.ok ? 200 : 502 });
}
