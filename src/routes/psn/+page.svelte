<script>
  import { enhance } from "$app/forms";

  let { data } = $props();

  const { status } = data;
  const valid = status.status === "valid";
  const needsRefresh = !valid;

  let npsso = $state("");
  let error = $state("");
  let success = $state("");

  function onSubmit({ result }) {
    if (result.type === "failure") {
      error = result.data?.error ?? "Refresh failed.";
      success = "";
    } else {
      success = "Credential refreshed ✓";
      error = "";
    }
  }

  function fmt(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    const date = d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    });
    const time = d.toLocaleTimeString();
    return `${date}, ${time}`;
  }
</script>

<svelte:head>
  <title>Pshelf — PSN credential</title>
</svelte:head>

<main class="psn">
  <header class="top">
    <div>
      <h1>PSN credential</h1>
      <p class="sub">
        Status of the PSN access used by mailroom's catalog sync.
      </p>
    </div>
  </header>

  <section class="card">
    <div class="status-row">
      <span class="badge {valid ? 'ok' : 'warn'}">{status.status}</span>
      {#if valid}
        <p class="good">Credential is valid.</p>
      {:else}
        <p class="bad">Credential needs refresh — paste a fresh NPSSO below.</p>
      {/if}
    </div>

    <dl class="kv">
      <dt>Last success</dt>
      <dd>{fmt(status.last_success)}</dd>
      <dt>Last error</dt>
      <dd>{status.last_error || "—"}</dd>
      <dt>Expires</dt>
      <dd>{fmt(status.expires_at)}</dd>
    </dl>
  </section>

  {#if needsRefresh}
    <section class="card">
      <h2>Refresh with NPSSO</h2>
      <ol class="steps">
        <li>
          Open <a
            href="https://ca.account.sony.com/api/v1/ssocookie"
            target="_blank"
            rel="noreferrer">ca.account.sony.com/api/v1/ssocookie</a
          > while signed in.
        </li>
        <li>Copy the <code>npsso</code> value from the response.</li>
        <li>Paste it below and hit Refresh.</li>
      </ol>

      <form method="POST" action="?/refresh" use:enhance={onSubmit}>
        <label for="npsso">NPSSO</label>
        <textarea
          id="npsso"
          name="npsso"
          bind:value={npsso}
          rows="3"
          placeholder="np_..."
          autocomplete="off"
          spellcheck="false"
        ></textarea>
        <button type="submit" disabled={!npsso.trim()}
          >Refresh credential</button
        >
      </form>

      {#if error}<p class="error">{error}</p>{/if}
      {#if success}<p class="ok">{success}</p>{/if}
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
  .psn {
    max-width: 640px;
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
  .card {
    background: #161a24;
    border: 1px solid #232838;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .status-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: capitalize;
  }
  .badge.ok {
    background: #143320;
    color: #7fd08a;
  }
  .badge.warn {
    background: #33280f;
    color: #e6c07a;
  }
  .good {
    color: #7fd08a;
    margin: 0;
  }
  .bad {
    color: #ffb27a;
    margin: 0;
  }
  .kv {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 8px 12px;
    margin: 0;
  }
  .kv dt {
    color: #9aa3b5;
  }
  .kv dd {
    margin: 0;
  }
  .steps {
    margin: 0 0 16px;
    padding-left: 20px;
    color: #b7c0d0;
    line-height: 1.6;
  }
  .steps code {
    background: #1f2330;
    padding: 2px 6px;
    border-radius: 4px;
  }
  form label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.9rem;
    color: #9aa3b5;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #2a2f3d;
    background: #10131b;
    color: inherit;
    font-family: monospace;
    margin-bottom: 12px;
  }
  button {
    padding: 10px 18px;
    border-radius: 8px;
    border: 1px solid #e94560;
    background: #e94560;
    color: #fff;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .error {
    color: #ff8a8a;
    margin-top: 10px;
  }
  .ok {
    color: #7fd08a;
    margin-top: 10px;
  }
</style>
