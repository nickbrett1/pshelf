import { fail, redirect } from "@sveltejs/kit";
import {
  getNeedsMatch,
  applyIgdbMatch,
  excludeNonGame,
} from "$lib/server/api-client.js";

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  return { games: await getNeedsMatch() };
}

export const actions = {
  /** Apply a chosen IGDB candidate to an owned game. */
  match: async ({ request }) => {
    const fd = await request.formData();
    const ownedGameId = Number(fd.get("owned_game_id"));
    const igdbId = Number(fd.get("igdb_id"));
    const note = fd.get("note")?.toString().trim() || null;
    if (!Number.isInteger(ownedGameId) || !Number.isInteger(igdbId)) {
      return fail(400, { error: "Missing owned_game_id or igdb_id" });
    }
    const result = await applyIgdbMatch(ownedGameId, igdbId, note);
    if (!result.ok) return fail(502, { error: result.error ?? "match failed" });
    redirect(303, "/fix");
  },

  /** Flag a non-game reject for exclusion (endpoint may not exist yet). */
  exclude: async ({ request }) => {
    const fd = await request.formData();
    const ownedGameId = Number(fd.get("owned_game_id"));
    const note = fd.get("note")?.toString().trim() || null;
    if (!Number.isInteger(ownedGameId))
      return fail(400, { error: "Missing owned_game_id" });
    const result = await excludeNonGame(ownedGameId, note);
    if (!result.ok) {
      return fail(502, {
        error: result.error ?? "exclude failed",
        unsupported: result.unsupported ?? false,
      });
    }
    redirect(303, "/fix");
  },
};
