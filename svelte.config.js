import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // adapter-node outputs a standalone Node server (build/index.js) for the Docker container
    // See https://kit.svelte.dev/docs/adapter-node for more information.
    adapter: adapter(),
    // Use absolute (root-relative) asset paths (`/favicon.svg`, `/_app/...`)
    // instead of relative (`./...`). Relative paths are resolved against the
    // current page URL and break for assets rendered into component markup.
    paths: { relative: false },
  },
};

export default config;
