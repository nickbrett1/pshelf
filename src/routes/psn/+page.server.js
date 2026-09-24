import { fail } from "@sveltejs/kit";
import {
  getPsnCredential,
  submitPsnCredential,
} from "$lib/server/api-client.js";
import { invalidateNavMetrics } from "$lib/server/nav-metrics.js";

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  return { status: await getPsnCredential() };
}

export const actions = {
  /**
   * Submit a fresh NPSSO to refresh the PSN credential, then read the
   * credential back so the response carries the *verified* result.
   *
   * mailroom exchanges the NPSSO synchronously: a bad/expired token fails the
   * POST (HTTP 400) and a good one flips the stored credential to
   * `status="valid"` before responding. Re-reading here means the UI can show
   * an authoritative "valid" / "still not valid" verdict immediately instead
   * of a generic success followed by a stale red banner.
   */
  refresh: async ({ request }) => {
    const fd = await request.formData();
    const npsso = fd.get("npsso")?.toString().trim() || "";
    if (!npsso) return fail(400, { error: "Paste an NPSSO first." });

    const result = await submitPsnCredential(npsso);
    // Read the credential back regardless of outcome: on success it confirms
    // the refresh took (and gives us the fresh last_success/expiry), on failure
    // it surfaces mailroom's recorded last_error.
    const status = await getPsnCredential();

    if (!result.ok) {
      return fail(502, {
        error: result.error ?? "refresh failed",
        status,
      });
    }
    // The exchange returned 200 — but only trust it once the stored credential
    // actually reads back as valid. This is the "immediate feedback" the old
    // flow lacked: never claim success while the banner would stay red.
    if (status.status !== "valid") {
      return fail(502, {
        error: status.last_error
          ? `Accepted, but the credential is still not valid: ${status.last_error}`
          : "Accepted, but the credential is still not valid — try refreshing again.",
        status,
      });
    }

    // The credential is good now — clear the cached nav counts so the catalog's
    // "Stale PSN Token" link disappears on the next load (up to 30s earlier,
    // otherwise), including the page data SvelteKit replays on Back/Forward.
    invalidateNavMetrics();

    // Return success in place (no self-redirect) so `use:enhance` doesn't push
    // a duplicate /psn history entry — which made the browser Back button
    // appear broken (it just went back to the same page).
    return { ok: true, status };
  },
};
