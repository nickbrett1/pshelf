<script>
  import GameRow from "./GameRow.svelte";

  let { data } = $props();
</script>

<svelte:head>
  <title>Pshelf — Fix IGDB matches</title>
</svelte:head>

<main class="fix">
  <header class="top">
    <div>
      <h1>Fix IGDB matches</h1>
      <p class="sub">
        Unmatched owned games ({data.games.length}). Search IGDB, pick the right
        game, then Match.
      </p>
    </div>
    <nav>
      <a href="/">← Catalog</a>
    </nav>
  </header>

  {#if data.games.length === 0}
    <section class="empty">
      <h2>Nothing to fix 🎉</h2>
      <p>All owned games are matched to IGDB.</p>
      <p class="note">
        If this is unexpected, the manual API (<code>MANUAL_API_URL</code>) may
        be unreachable from the container.
      </p>
    </section>
  {:else}
    <section class="list">
      {#each data.games as game (game.id)}
        <GameRow {game} />
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
  .fix {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px 20px 64px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 1.6rem;
  }
  .sub {
    margin: 0;
    color: #9aa3b5;
  }
  nav a {
    color: #e94560;
    text-decoration: none;
  }
  .empty {
    text-align: center;
    padding: 60px 20px;
    color: #b7c0d0;
  }
  .note code {
    background: #1f2330;
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
