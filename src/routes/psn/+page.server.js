import { fail, redirect } from "@sveltejs/kit";
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
    redirect(303, "/psn");
  },
};
