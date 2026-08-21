<script>
  // SSR-safe cover image. Renders the placeholder letter underneath and the
  // <img> above it, hidden until the image has actually loaded. Revealing on
  // load (rather than hiding on error) avoids the SSR/hydration bug where an
  // image that loads during SSR then errors out on hydration and vanishes.
  //
  // The `use:reveal` action runs once on mount. If the image already finished
  // loading before hydration (so no `load` event will fire), it reveals it
  // immediately; otherwise it waits for `load`.
  let { game } = $props();

  let coverReady = $state(false);

  function reveal(img) {
    // Already loaded successfully (e.g. during SSR) -> reveal immediately.
    if (img.complete && img.naturalWidth > 0) {
      coverReady = true;
    }
    // Always listen for load/error too. A freshly-hydrated <img> can report
    // `complete === true` with `naturalWidth === 0` before its src loads, so
    // we can't rely on the initial state alone — attach listeners in all cases.
    img.addEventListener(
      "load",
      () => {
        coverReady = true;
      },
      { once: true },
    );
    img.addEventListener(
      "error",
      () => {
        coverReady = false;
      },
      { once: true },
    );
  }
</script>

<div class="cover">
  {#if game.cover}
    <img
      use:reveal
      src={game.cover}
      alt=""
      width="210"
      height="280"
      decoding="async"
      class:ready={coverReady}
    />
  {/if}
  <div class="cover-placeholder">{game.title.charAt(0)}</div>
</div>

<style>
  .cover {
    position: relative;
    aspect-ratio: 3 / 4;
    background: #1f2330;
    overflow: hidden;
  }
  .cover img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 1;
  }
  .cover img.ready {
    opacity: 1;
  }
  .cover-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    color: #3a4256;
  }
</style>
