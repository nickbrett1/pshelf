import { json } from "@sveltejs/kit";
import { igdbSearch } from "$lib/server/api-client.js";

// Server-side proxy for IGDB search so the browser never talks to the NAS MCP
// directly (avoids CORS and keeps API details server-side).
// GET /api/igdb/search?title=Bloodborne
export async function GET({ url }) {
  const title = url.searchParams.get("title")?.trim();
  if (!title) {
    return json({ candidates: [], error: "missing title" });
  }
  const candidates = await igdbSearch(title);
  return json({ candidates });
}
