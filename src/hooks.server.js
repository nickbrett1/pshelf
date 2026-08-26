// Runs once when the server starts (SvelteKit `init` hook). Warms the
// in-process catalog cache so the *first* page load doesn't pay the full
// ~244 MB DB scan — it serves from memory instead. See loadCatalog in
// catalog-store.js (memo "Pshelf slow to load").
import { loadCatalog } from "$lib/server/catalog-store.js";

/** @type {import('@sveltejs/kit').Init} */
export function init() {
  try {
    const count = loadCatalog().length;
    console.log(`[pshelf] catalog cache warmed (${count} games)`);
  } catch (err) {
    // Never block startup on a cache warm — the first request will fall back
    // to a cold load (and cache) as before.
    console.error("[pshelf] failed to warm catalog cache:", err);
  }
}

// ---- In-app HTTP compression ----
//
// adapter-node serves directly with no reverse proxy, so dynamic SSR HTML
// (which inlines the whole catalog — ~890 KB) was sent uncompressed on every
// load. We gzip compressible GET responses here in the `handle` hook using
// Node's built-in CompressionStream (no new deps, no Docker changes). It's a
// streaming transform, so SvelteKit's streamed page data still streams.
//
// Compressible types only (text/html, json, js, css, ...) — images and
// already-encoded bodies are left untouched. Responses without a
// Content-Length (streamed) are compressed regardless of size; known sizes
// are skipped below 1 KB to avoid pointless overhead.

const MIN_COMPRESS_BYTES = 1024;
const COMPRESSIBLE_TYPE =
  /^text\/|^application\/(?:json|javascript|x-javascript)|\+json$/i;

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const response = await resolve(event);

  // Only GET, gzip-requesting clients, not already compressed, compressible
  // type, with a body we can stream (null body = HEAD/204/etc).
  const method = event.request.method;
  const acceptEncoding = event.request.headers.get("accept-encoding") ?? "";
  const contentType = response.headers.get("content-type") ?? "";
  const contentEncoding = response.headers.get("content-encoding") ?? "";
  const declaredLength = Number(response.headers.get("content-length") ?? NaN);
  const isStreamed = Number.isNaN(declaredLength);

  if (
    method !== "GET" ||
    !/\bgzip\b/.test(acceptEncoding) ||
    contentEncoding ||
    !COMPRESSIBLE_TYPE.test(contentType) ||
    !response.body ||
    (!isStreamed && declaredLength < MIN_COMPRESS_BYTES)
  ) {
    return response;
  }

  try {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("content-encoding", "gzip");
    const vary = headers.get("vary");
    headers.set("vary", vary ? `${vary}, accept-encoding` : "accept-encoding");

    const body = response.body.pipeThrough(new CompressionStream("gzip"));
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    // Fall back to the uncompressed response rather than failing the request.
    console.error("[pshelf] compression failed:", err.message);
    return response;
  }
}
