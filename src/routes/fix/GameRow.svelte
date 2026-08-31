<script>
  import { enhance } from "$app/forms";

  let { game } = $props();

  // Prepopulate the IGDB search with the game's title — that's the term the
  // user always searches for. They can still edit it before searching.
  let query = $state(game.title);
  let candidates = $state([]);
  let searching = $state(false);
  let searchError = $state("");
  let note = $state("");
  let actionMsg = $state("");
  let actionError = $state("");
  let showExclude = $state(false);
  let selectedId = $state(null);

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    searching = true;
    searchError = "";
    candidates = [];
    try {
      const res = await fetch(
        `/api/igdb/search?title=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      candidates = data.candidates ?? [];
      if (!candidates.length) searchError = "No IGDB candidates found.";
    } catch {
      searchError = "Search failed — is the IGDB MCP reachable?";
    } finally {
      searching = false;
    }
  }

  function pick(c) {
    // Store the selected candidate so the match form submits it and the
    // candidate list highlights it (reactive via `selectedId`).
    selectedId = c.igdb_id;
  }

  function onMatch({ result }) {
    if (result.type === "failure") {
      actionError = result.data?.error ?? "Match failed.";
    } else {
      actionMsg = "Matched ✓";
    }
  }

  function onExclude({ result }) {
    if (result.type === "failure") {
      actionError = result.data?.unsupported
        ? "Exclude endpoint not implemented yet (flagged for future manual-edit)."
        : (result.data?.error ?? "Exclude failed.");
    } else {
      actionMsg = "Excluded ✓";
    }
  }
</script>

<article class="row">
  <header>
    <h3>{game.title}</h3>
    <div class="meta">
      {#if game.platform}<span>{game.platform}</span>{/if}
      {#if game.format}<span>{game.format}</span>{/if}
    </div>
  </header>

  <div class="search">
    <input
      type="search"
      bind:value={query}
      placeholder="Search IGDB…"
      aria-label="Search IGDB for {game.title}"
      onkeydown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())}
    />
    <button type="button" onclick={doSearch} disabled={searching}>
      {searching ? "Searching…" : "Search"}
    </button>
  </div>

  {#if searchError}<p class="error">{searchError}</p>{/if}

  {#if candidates.length}
    <ul class="candidates">
      {#each candidates as c (c.igdb_id)}
        <li data-cand={c.igdb_id}>
          <button
            type="button"
            class="cand"
            class:selected={selectedId === c.igdb_id}
            onclick={() => pick(c)}
            data-cand={c.igdb_id}
          >
            <span class="cand-name">{c.name}</span>
            {#if c.year}<span class="cand-year">{c.year}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <form
    method="POST"
    action="?/match"
    use:enhance={() =>
      ({ result, update }) => {
        onMatch({ result });
        update();
      }}
  >
    <input type="hidden" name="owned_game_id" value={game.id} />
    <input type="hidden" name="igdb_id" value={selectedId ?? ""} />
    <input type="hidden" name="note" value="matched via pshelf UI" />
    <button type="submit" disabled={selectedId == null}>Match</button>
  </form>

  <button
    type="button"
    class="link"
    onclick={() => (showExclude = !showExclude)}
  >
    Not a game (demo/OST/artbook)? Exclude…
  </button>
  {#if showExclude}
    <form
      method="POST"
      action="?/exclude"
      use:enhance={() =>
        ({ result, update }) => {
          onExclude({ result });
          update();
        }}
    >
      <input type="hidden" name="owned_game_id" value={game.id} />
      <input
        type="text"
        name="note"
        bind:value={note}
        placeholder="Reason (optional)"
      />
      <button type="submit" class="danger">Exclude</button>
    </form>
  {/if}

  {#if actionMsg}<p class="ok">{actionMsg}</p>{/if}
  {#if actionError}<p class="error">{actionError}</p>{/if}
</article>

<style>
  .row {
    background: #161a24;
    border: 1px solid #232838;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 14px;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 10px;
  }
  h3 {
    margin: 0;
  }
  .meta {
    display: flex;
    gap: 6px;
  }
  .meta span {
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 20px;
    background: #222838;
  }
  .search {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }
  .search input {
    flex: 1;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #2a2f3d;
    background: #10131b;
    color: inherit;
  }
  .search button {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #2a2f3d;
    background: #222838;
    color: inherit;
    cursor: pointer;
  }
  .candidates {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cand {
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #2a2f3d;
    background: #10131b;
    color: inherit;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .cand.selected {
    border-color: #e94560;
    background: #1f1a2e;
  }
  .cand-year {
    color: #9aa3b5;
  }
  button[type="submit"] {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid #e94560;
    background: #e94560;
    color: #fff;
    cursor: pointer;
  }
  button[type="submit"]:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  button.danger {
    border-color: #b84a4a;
    background: transparent;
    color: #ff8a8a;
  }
  .link {
    background: none;
    border: none;
    color: #9aa3b5;
    cursor: pointer;
    padding: 4px 0;
    text-decoration: underline;
  }
  .ok {
    color: #7fd08a;
    margin: 8px 0 0;
  }
  .error {
    color: #ff8a8a;
    margin: 8px 0 0;
  }
</style>
