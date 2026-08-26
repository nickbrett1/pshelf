<script>
  import { assets } from "$app/paths";
  import GameCover from "$lib/GameCover.svelte";
  import {
    filterGames,
    formatAcquisitionDate,
    keepIfCancelPsPlus,
    normalizePlatform,
    parseAcquisitionDate,
  } from "$lib/catalog.js";

  let { data } = $props();

  // Search + filters
  let query = $state("");
  let debouncedQuery = $state("");
  let platformFilter = $state("all");
  let formatFilter = $state("all");
  let classFilter = $state("all");
  let genreFilter = $state("all");
  let sortBy = $state("purchased");

  let debounceTimer;
  function onSearchInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedQuery = query;
    }, 200);
  }

  // One game per card; platforms/formats/ownership are distinct lists across
  // the game's editions (Catalog Games Model).
  const platforms = $derived(
    [
      ...new Set(
        data.games
          .flatMap((g) => (g.platforms ?? []).map(normalizePlatform))
          .filter(Boolean),
      ),
    ].sort(),
  );
  const formats = $derived(
    [
      ...new Set(data.games.flatMap((g) => g.formats ?? []).filter(Boolean)),
    ].sort(),
  );
  const classes = $derived(
    [
      ...new Set(
        data.games.flatMap((g) => g.ownership_classes ?? []).filter(Boolean),
      ),
    ].sort(),
  );
  const genres = $derived(
    [...new Set(data.games.flatMap((g) => g.genres ?? []))]
      .filter(Boolean)
      .sort(),
  );

  const filtered = $derived.by(() => {
    let games = filterGames(data.games, debouncedQuery);
    if (platformFilter === "psvr2") {
      games = games.filter((g) => g.psvr2);
    } else if (platformFilter !== "all") {
      games = games.filter((g) =>
        (g.platforms ?? []).some(
          (p) => normalizePlatform(p) === platformFilter,
        ),
      );
    }
    if (formatFilter !== "all")
      games = games.filter((g) => (g.formats ?? []).includes(formatFilter));
    if (classFilter !== "all")
      games = games.filter((g) =>
        (g.ownership_classes ?? []).includes(classFilter),
      );
    if (genreFilter !== "all")
      games = games.filter((g) => (g.genres ?? []).includes(genreFilter));
    return games;
  });

  const sorted = $derived.by(() => {
    const games = [...filtered];
    games.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "rating":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "purchased":
          // Most recent purchase first (descending); no date sorts last.
          // Dates are parsed to a sortable number (mailroom stores them as
          // human-readable strings like "Nov 27, 2024", not ISO).
          return (
            (purchaseDate(b) ?? -Infinity) - (purchaseDate(a) ?? -Infinity)
          );
        default:
          return 0;
      }
    });
    return games;
  });

  const split = $derived(keepIfCancelPsPlus(data.games));

  // Hero stats: physical discs and PSVR2 titles (is_psvr2 from catalog_games).
  // "Physical" counts games that have at least one physical edition.
  const physicalCount = $derived(
    data.games.filter((g) => (g.formats ?? []).includes("physical")).length,
  );
  const psvr2Count = $derived(data.games.filter((g) => g.psvr2).length);

  // Progressive rendering: render the first PAGE games server-side, then reveal
  // more as the user scrolls (IntersectionObserver sentinel). This keeps the
  // initial SSR HTML and DOM small — the covers themselves are already
  // lazy-loaded, so the big cost was 1,000+ cards in the initial payload.
  // Searching/filtering bypasses the cap and shows every match.
  const PAGE = 60;
  let visibleCount = $state(PAGE);

  const hasActiveFilter = $derived(
    debouncedQuery.trim() !== "" ||
      platformFilter !== "all" ||
      formatFilter !== "all" ||
      classFilter !== "all" ||
      genreFilter !== "all",
  );

  const visible = $derived(
    hasActiveFilter ? sorted : sorted.slice(0, visibleCount),
  );

  // Action on the sentinel: observe it directly so there's no bind:this +
  // onMount timing race (which left the observer unset and stalled the load).
  function loadMore(node) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          visibleCount += PAGE;
        }
      },
      { rootMargin: "800px" },
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  // Highlight matched substrings in title/genre/platform/retailer.
  function highlight(text) {
    const q = debouncedQuery.trim();
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "ig");
    return text.replace(re, "<mark>$1</mark>");
  }

  function formatClass(cls) {
    const labels = {
      purchased: "Purchased",
      psplus_claimed: "PS+ Claimed",
      psplus_extra: "PS+ Extra",
    };
    return labels[cls] ?? cls;
  }

  function formatLabel(fmt) {
    return fmt
      ? String(fmt).charAt(0).toUpperCase() + String(fmt).slice(1)
      : fmt;
  }

  // Expanded multi-edition detail (Catalog Games Model): toggles a game's
  // editions list on the card.
  let expanded = $state(new Set());
  function toggleExpand(id) {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expanded = next;
  }

  function formatPrice(price) {
    if (price == null || price === "") return null;
    const n = Number(price);
    if (Number.isNaN(n)) return null;
    return `$${n.toFixed(2)}`;
  }

  // Latest acquisition/purchase date for a game, for the "Purchase Date" sort.
  // Prefers the most recent edition acquisition date (a game can have several
  // editions bought at different times), falling back to the game-level
  // earliest_acquisition. Returns a sortable timestamp, or null when unknown
  // (unknown sorts last). Mailroom dates are human-readable strings, so they
  // must go through parseAcquisitionDate before comparing.
  function purchaseDate(game) {
    const dates = (game.editions ?? [])
      .map((ed) => parseAcquisitionDate(ed.acquisition_date))
      .filter((d) => d != null);
    const earliest = parseAcquisitionDate(game.earliest_acquisition);
    if (earliest != null) dates.push(earliest);
    return dates.length ? Math.max(...dates) : null;
  }

  function resetFilters() {
    query = "";
    debouncedQuery = "";
    platformFilter = "all";
    formatFilter = "all";
    classFilter = "all";
    genreFilter = "all";
    sortBy = "purchased";
  }
</script>

<svelte:head>
  <title>Pshelf — PlayStation Catalog</title>
</svelte:head>

<main class="catalog">
  <header class="hero">
    <div class="hero-inner">
      <div class="brand">
        <img src="{assets}/favicon.svg" alt="Pshelf" class="logo" />
        <h1>Pshelf</h1>
        <p class="tagline">PlayStation Games on the Shelf</p>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-num">{data.games.length}</span>
          <span class="stat-label">Games</span>
        </div>
        <div class="stat">
          <span class="stat-num">{physicalCount}</span>
          <span class="stat-label">Physical</span>
        </div>
        <div class="stat">
          <span class="stat-num">{split.psplus}</span>
          <span class="stat-label">On PS+</span>
        </div>
        <div class="stat">
          <span class="stat-num">{psvr2Count}</span>
          <span class="stat-label">PSVR2</span>
        </div>
      </div>
      <nav>
        {#await data.nav}
          <span class="nav-pending" aria-hidden="true"></span>
        {:then nav}
          {#if nav.needsMatchCount > 0}
            <a href="/fix">Fix IGDB ({nav.needsMatchCount})</a>
          {/if}
          {#if nav.psnNeedsRefresh}
            <a href="/psn">Stale PSN Token</a>
          {/if}
        {:catch}
          <!-- counts unavailable; no nav links -->
        {/await}
      </nav>
    </div>
  </header>

  {#if data.games.length === 0}
    <section class="empty">
      <h2>No catalog loaded</h2>
      <p>
        Pshelf reads <code>catalog_games</code> (one card per logical game, per
        the Catalog Games Model) from the read-only
        <code>/data</code>
        mount. The catalog DB wasn't found — check <code>CATALOG_DB_PATH</code>
        and that the
        <code>/volume1/docker/mailroom/data</code> volume is mounted.
      </p>
    </section>
  {:else}
    <section class="controls">
      <input
        type="search"
        placeholder="Search Title…"
        class="search"
        bind:value={query}
        oninput={onSearchInput}
        aria-label="Search catalog"
      />

      <div class="filters">
        <select bind:value={platformFilter} aria-label="Filter by platform">
          <option value="all">All Platforms</option>
          {#each platforms as p}
            <option value={p}>{p}</option>
          {/each}
          <option value="psvr2">PSVR2</option>
        </select>

        <select bind:value={formatFilter} aria-label="Filter by format">
          <option value="all">All Formats</option>
          {#each formats as f}
            <option value={f}>{formatLabel(f)}</option>
          {/each}
        </select>

        <select bind:value={classFilter} aria-label="Filter by ownership">
          <option value="all">All Ownership</option>
          {#each classes as c}
            <option value={c}>{formatClass(c)}</option>
          {/each}
        </select>

        <select bind:value={genreFilter} aria-label="Filter by genre">
          <option value="all">All Genres</option>
          {#each genres as g}
            <option value={g}>{g}</option>
          {/each}
        </select>

        <select bind:value={sortBy} aria-label="Sort">
          <option value="title">Sort by Title</option>
          <option value="rating">Sort by Rating</option>
          <option value="purchased">Sort by Purchase Date</option>
        </select>

        <button class="reset" onclick={resetFilters}>Reset</button>
      </div>

      <p class="count">{sorted.length} of {data.games.length} games</p>
    </section>

    <section class="grid">
      {#each visible as game (game.key)}
        <button
          type="button"
          class="card"
          class:expanded={expanded.has(game.id)}
          onclick={() => toggleExpand(game.id)}
        >
          <GameCover {game} />
          <div class="card-body">
            <h3 class="title">
              {@html highlight(game.title)}
              {#if game.psvr2}
                <span class="badge psvr2">PSVR2</span>
              {/if}
            </h3>
            <div class="meta">
              <span class="platform">
                {(game.platforms ?? [])
                  .map(normalizePlatform)
                  .filter(Boolean)
                  .join(" / ")}
              </span>
              {#if (game.formats ?? []).length}
                <span class="format">
                  {(game.formats ?? []).map(formatLabel).join(" / ")}
                </span>
              {/if}
              {#if (game.num_editions ?? 1) > 1}
                <span class="editions">{game.num_editions} editions</span>
              {/if}
            </div>
            {#if !game.purchased}
              <span class="badge lost">On PS+</span>
            {/if}
            {#if game.genres.length}
              <p class="genres">{@html highlight(game.genres.join(", "))}</p>
            {/if}
            {#if game.retailer}
              <p class="retailer">via {game.retailer}</p>
            {/if}
            {#if game.rating}
              <p class="rating">★ {game.rating.toFixed(1)}</p>
            {/if}
          </div>
          {#if expanded.has(game.id) && game.editions.length}
            <div class="editions-panel">
              <h4>Editions</h4>
              {#each game.editions as ed (ed.id ?? ed.title ?? ed)}
                <div class="edition">
                  <span class="ed-title">{ed.title ?? game.title}</span>
                  <span class="ed-meta">
                    {#if ed.platform}
                      {normalizePlatform(ed.platform)}
                    {/if}
                    {#if ed.format}{formatLabel(ed.format)}{/if}
                  </span>
                  <span
                    class="ed-class"
                    class:owned={ed.ownership_class === "purchased"}
                  >
                    {formatClass(ed.ownership_class)}
                  </span>
                  {#if formatPrice(ed.price)}
                    <span class="ed-price">{formatPrice(ed.price)}</span>
                  {/if}
                  <span class="ed-date">
                    {formatAcquisitionDate(ed.acquisition_date) ?? "Unknown"}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
          {#if expanded.has(game.id) && game.igdb_id != null}
            <span class="igdb-id">IGDB {game.igdb_id}</span>
          {/if}
        </button>
      {/each}
    </section>

    {#if !hasActiveFilter && visible.length < sorted.length}
      <div class="load-more" use:loadMore>…</div>
    {/if}
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    background: #0f1117;
    color: #e6e8ee;
    font-family:
      system-ui,
      -apple-system,
      "Segoe UI",
      Roboto,
      sans-serif;
  }
  :global(mark) {
    background: #e94560;
    color: #fff;
    border-radius: 2px;
    padding: 0 2px;
  }

  .catalog {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 20px 64px;
  }

  .hero {
    background: linear-gradient(135deg, #1a1a2e, #0f3460);
    border-radius: 16px;
    padding: 28px 32px;
    margin-bottom: 24px;
  }
  .hero-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logo {
    width: 48px;
    height: 48px;
  }
  .brand h1 {
    margin: 0;
    font-size: 2rem;
  }
  .tagline {
    margin: 0;
    color: #b7c0d0;
  }
  .stats {
    display: flex;
    gap: 24px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .stat-num {
    font-size: 1.8rem;
    font-weight: 700;
  }
  .stat-label {
    color: #b7c0d0;
    font-size: 0.85rem;
  }
  nav {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  nav a {
    color: #e94560;
    text-decoration: none;
    font-weight: 600;
    white-space: nowrap;
  }
  nav a:hover {
    text-decoration: underline;
  }
  /* Reserve nav height while the streamed link counts are loading so the
     header doesn't shift once they arrive. */
  .nav-pending {
    display: inline-block;
    min-width: 20px;
    min-height: 18px;
  }

  .empty {
    text-align: center;
    padding: 60px 20px;
    color: #b7c0d0;
  }
  .empty code {
    background: #1f2330;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .controls {
    position: sticky;
    top: 0;
    z-index: 20;
    margin-bottom: 20px;
    padding: 10px 0;
    background: #0f1117;
    border-bottom: 1px solid #1c2130;
  }
  .search {
    width: 100%;
    padding: 12px 16px;
    font-size: 1rem;
    border-radius: 10px;
    border: 1px solid #2a2f3d;
    background: #161a24;
    color: inherit;
    margin-bottom: 12px;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .filters select {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #2a2f3d;
    background: #161a24;
    color: inherit;
  }
  .reset {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #e94560;
    background: transparent;
    color: #e94560;
    cursor: pointer;
  }
  .reset:hover {
    background: #e94560;
    color: #fff;
  }
  .count {
    color: #b7c0d0;
    font-size: 0.9rem;
    margin-top: 10px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 18px;
  }
  .load-more {
    text-align: center;
    padding: 24px 0;
    color: #4a5268;
  }
  .card {
    background: #161a24;
    border: 1px solid #232838;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease;
    text-align: left;
    font: inherit;
    padding: 0;
    color: inherit;
    width: 100%;
  }
  .card:hover {
    border-color: #2f3650;
  }
  .card.expanded {
    border-color: #e94560;
  }
  .card-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }
  .title {
    margin: 0;
    font-size: 1rem;
    line-height: 1.25;
  }
  /* PSVR2 badge on the card title — the game is a PSVR2 title (is_psvr2 from
     catalog_games). Distinct cyan/blue so it's easy to spot at a glance. */
  .title .badge.psvr2 {
    display: inline-block;
    margin-left: 6px;
    vertical-align: middle;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 7px;
    border-radius: 20px;
    background: #0e4b5e;
    color: #7ee0ff;
    border: 1px solid #1f7a96;
    white-space: nowrap;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .meta span {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 20px;
    background: #222838;
  }
  .genres {
    margin: 0;
    color: #9aa3b5;
    font-size: 0.8rem;
  }
  .retailer {
    margin: 0;
    color: #6b7488;
    font-size: 0.75rem;
  }
  .rating {
    margin: 0;
    margin-top: auto;
    color: #ffd166;
    font-size: 0.85rem;
    font-weight: 600;
  }

  /* "On PS+" indicator — only shown when the game would be LOST if PS+ is
     cancelled (not purchased). Owned games need no badge; they're the norm. */
  .badge.lost {
    align-self: flex-start;
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 20px;
    background: #3a3142;
    color: #cbb8e0;
  }

  /* Multi-edition badge in the card meta. */
  .meta .editions {
    background: #2b2a3a;
    color: #c7cbe0;
    font-weight: 600;
  }

  /* Expanded editions detail. */
  .editions-panel {
    border-top: 1px solid #232838;
    padding: 12px;
    background: #12151d;
  }
  .editions-panel h4 {
    margin: 0 0 8px;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #7c85a0;
  }
  .edition {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: baseline;
    padding: 6px 0;
    border-bottom: 1px solid #1a1f2b;
    font-size: 0.8rem;
  }
  .edition:last-child {
    border-bottom: none;
  }
  .ed-title {
    font-weight: 600;
    color: #e6e8ee;
  }
  .ed-meta {
    color: #9aa3b5;
  }
  .ed-class {
    color: #cbb8e0;
  }
  .ed-class.owned {
    color: #7ce8b0;
  }
  .ed-price {
    color: #ffd166;
  }
  .ed-date {
    color: #6b7488;
  }

  /* Discreet IGDB id, shown bottom-right of an expanded card — a debug aid
     (e.g. for the mailroom game-splitting bug) without cluttering the grid. */
  .igdb-id {
    margin-left: auto;
    margin-top: auto;
    padding: 3px 10px 6px;
    font-size: 0.62rem;
    color: #4a5268;
    letter-spacing: 0.04em;
    user-select: all;
  }
</style>
