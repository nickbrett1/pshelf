// Serve mailroom's locally-cached cover images from the shared /data volume.
//
// mailroom fetches IGDB covers at sync time and writes them to
// /data/covers/<image_id>.jpg (memos/covers-caching-design). catalog_views
// exposes cover_local = '/covers/<image_id>.jpg' for each cached game; the
// browser requests that path and this route streams the file straight from
// disk — no live upstream IGDB fetch, no open-proxy surface.

import { readFile } from "node:fs/promises";
import path from "node:path";

const COVERS_DIR = process.env.COVERS_DIR ?? "/data/covers";
const CACHE = "public, max-age=604800, immutable";

// Only serve a plain image filename to avoid path traversal / open-proxy use.
const IMAGE_NAME = /^[\w.-]+\.(jpe?g|png|webp|avif)$/i;

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".jpe":
    case ".jpeg":
    case ".jpg":
    default:
      return "image/jpeg";
  }
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
  const { imageId } = params;
  if (!imageId || !IMAGE_NAME.test(imageId)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const body = await readFile(path.join(COVERS_DIR, imageId));
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": contentType(imageId),
        "cache-control": CACHE,
        "content-length": String(body.byteLength),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
