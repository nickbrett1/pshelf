import { fail } from "@sveltejs/kit";
import {
  getPsnCredential,
  submitPsnCredential,
} from "$lib/server/api-client.js";

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  return { status: await getPsnCredential() };
}

export const actions = {
  /** Submit a fresh NPSSO to refresh the PSN credential. */
  refresh: async ({ request }) => {
    const fd = await request.formData();
    const npsso = fd.get("npsso")?.toString().trim() || "";
    if (!npsso) return fail(400, { error: "Paste an NPSSO first." });
    const result = await submitPsnCredential(npsso);
    if (!result.ok)
      return fail(502, { error: result.error ?? "refresh failed" });
    // Return success in place (no self-redirect) so `use:enhance` doesn't push
    // a duplicate /psn history entry — which made the browser Back button
    // appear broken (it just went back to the same page).
    return { ok: true };
  },
};
