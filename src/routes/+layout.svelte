<script>
  // Root layout: renders the current page and (client-side only) registers the
  // PWA service worker so the catalog keeps working offline. Registration is
  // gated behind onMount so the SSR response never touches navigator.
  import { onMount } from "svelte";
  import { registerSW } from "virtual:pwa-register";

  let { children } = $props();

  onMount(() => {
    // `immediate: true` registers the service worker as soon as the page loads
    // (no need to wait for a first interaction). With registerType: "autoUpdate"
    // a freshly-deployed build activates and reloads the page automatically.
    registerSW({ immediate: true });
  });
</script>

{@render children()}
