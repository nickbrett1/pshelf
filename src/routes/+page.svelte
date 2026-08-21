<script>
  import { filterGames, keepIfCancelPsPlus } from "$lib/catalog.js";

  let { data } = $props();

  // Search + filters
  let query = $state("");
  let debouncedQuery = $state("");
  let platformFilter = $state("all");
  let formatFilter = $state("all");
  let classFilter = $state("all");
  let sortBy = $state("title");

  let debounceTimer;
  function onSearchInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedQuery = query;
    }, 200);
  }

  const platforms = $derived(
    [...new Set(data.games.map((g) => g.platform).filter(Boolean))].sort(),
  );
  const formats = $derived(
    [...new Set(data.games.map((g) => g.format).filter(Boolean))].sort(),
  );
  const classes = $derived(
    [
      ...new Set(data.games.map((g) => g.ownership_class).filter(Boolean)),
    ].sort(),
  );

  const filtered = $derived.by(() => {
    let games = filterGames(data.games, debouncedQuery);
    if (platformFilter !== "all")
      games = games.filter((g) => g.platform === platformFilter);
    if (formatFilter !== "all")
      games = games.filter((g) => g.format === formatFilter);
    if (classFilter !== "all")
      games = games.filter((g) => g.ownership_class === classFilter);
    return games;
  });

  const sorted = $derived.by(() => {
    const games = [...filtered];
    games.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "platform":
          return (
            a.platform.localeCompare(b.platform) ||
            a.title.localeCompare(b.title)
          );
        case "rating":
          return (b.rating ?? 0) - (a.rating ?? 0);
        default:
          return 0;
      }
    });
    return games;
  });

  const split = $derived(keepIfCancelPsPlus(data.games));

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

  function resetFilters() {
    query = "";
    debouncedQuery = "";
    platformFilter = "all";
    formatFilter = "all";
    classFilter = "all";
    sortBy = "title";
  }
</script>

<svelte:head>
  <title>Pshelf — PlayStation Catalog</title>
</svelte:head>

<main class="catalog">
  <header class="hero">
    <div class="hero-inner">
      <div class="brand">
        <img src="%sveltekit.assets%/favicon.svg" alt="Pshelf" class="logo" />
        <h1>Pshelf</h1>
        <p class="tagline">Your PlayStation catalog</p>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="stat-num">{data.games.length}</span>
          <span class="stat-label">Games</span>
        </div>
        <div class="stat">
          <span class="stat-num">{split.owned}</span>
          <span class="stat-label">Keep if PS+ canceled</span>
        </div>
        <div class="stat">
          <span class="stat-num">{split.psplus}</span>
          <span class="stat-label">On PS+</span>
        </div>
      </div>
      <nav>
        <a href="/fix">Fix IGDB</a>
        <a href="/psn">PSN</a>
      </nav>
    </div>
  </header>

  {#if data.games.length === 0}
    <section class="empty">
      <h2>No catalog loaded</h2>
      <p>
        Pshelf reads <code>catalog_views</code> from the read-only
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
        placeholder="Search title, genre, platform, retailer…"
        class="search"
        bind:value={query}
        oninput={onSearchInput}
        aria-label="Search catalog"
      />

      <div class="filters">
        <select bind:value={platformFilter} aria-label="Filter by platform">
          <option value="all">All platforms</option>
          {#each platforms as p}
            <option value={p}>{p}</option>
          {/each}
        </select>

        <select bind:value={formatFilter} aria-label="Filter by format">
          <option value="all">All formats</option>
          {#each formats as f}
            <option value={f}>{f}</option>
          {/each}
        </select>

        <select bind:value={classFilter} aria-label="Filter by ownership">
          <option value="all">All ownership</option>
          {#each classes as c}
            <option value={c}>{formatClass(c)}</option>
          {/each}
        </select>

        <select bind:value={sortBy} aria-label="Sort">
          <option value="title">Sort by title</option>
          <option value="platform">Sort by platform</option>
          <option value="rating">Sort by rating</option>
        </select>

        <button class="reset" onclick={resetFilters}>Reset</button>
      </div>

      <p class="count">{sorted.length} of {data.games.length} games</p>
    </section>

    <section class="grid">
      {#each sorted as game (game.id ?? game.title)}
        <article class="card">
          <div class="cover">
            {#if game.cover}
              <img src={game.cover} alt="" loading="lazy" />
            {:else}
              <div class="cover-placeholder">{game.title.charAt(0)}</div>
            {/if}
          </div>
          <div class="card-body">
            <h3 class="title">{@html highlight(game.title)}</h3>
            <div class="meta">
              <span class="platform">{game.platform}</span>
              <span class="format">{game.format}</span>
              <span class="class">{formatClass(game.ownership_class)}</span>
            </div>
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
        </article>
      {/each}
    </section>
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
    margin-bottom: 20px;
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
  .card {
    background: #161a24;
    border: 1px solid #232838;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .cover {
    aspect-ratio: 3 / 4;
    background: #1f2330;
    overflow: hidden;
  }
  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    color: #3a4256;
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
</style>
