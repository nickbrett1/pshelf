// Same-origin proxy for IGDB cover images. The browser requests
// /img/igdb/image/upload/... and this route fetches the image from
// images.igdb.com server-side. This keeps every cover on the pshelf origin so
// covers render even in browsers/networks that can't load images.igdb.com
// directly (e.g. iOS Safari), and lets the site cache them.

const IGDB_IMAGE_HOST = "https://images.igdb.com";

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, fetch }) {
  const path = params.path;

  // Only ever proxy IGDB image-upload paths (also prevents open-proxy use).
  if (!path || !/^igdb\/image\/upload\/[a-z0-9_/.-]+$/i.test(path)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const upstream = await fetch(`${IGDB_IMAGE_HOST}/${path}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) return new Response("Upstream error", { status: 502 });

    const body = await upstream.arrayBuffer();
    const type = upstream.headers.get("content-type") || "image/jpeg";
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=604800, immutable",
        "content-length": String(body.byteLength),
      },
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
}
