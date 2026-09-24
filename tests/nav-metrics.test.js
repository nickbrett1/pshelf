import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getNavMetrics,
  invalidateNavMetrics,
} from "../src/lib/server/nav-metrics.js";

/**
 * Build a fetch stub that answers mailroom's needs-match and psn-credential
 * endpoints. `state` lets a test mutate what the credential endpoint reports.
 */
function stubMailroom(state) {
  const fetchMock = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("/manual/needs-match")) {
      return { ok: true, json: async () => ({ items: state.needsMatch }) };
    }
    if (u.includes("/manual/psn-credential")) {
      return { ok: true, json: async () => ({ status: state.status }) };
    }
    throw new Error(`unexpected fetch: ${u}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  invalidateNavMetrics();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getNavMetrics", () => {
  it("reports the needs-match count and the PSN flag", async () => {
    stubMailroom({
      needsMatch: [{ owned_game_id: 1 }, { owned_game_id: 2 }],
      status: "needs_refresh",
    });
    expect(await getNavMetrics()).toMatchObject({
      needsMatchCount: 2,
      psnNeedsRefresh: true,
    });
  });

  it("caches the result within the TTL (one fetch per endpoint)", async () => {
    const fetchMock = stubMailroom({
      needsMatch: [],
      status: "needs_refresh",
    });
    await getNavMetrics();
    await getNavMetrics();
    expect(fetchMock).toHaveBeenCalledTimes(2); // needs-match + psn-credential
  });

  it("invalidateNavMetrics forces a fresh read (so a refresh clears the link)", async () => {
    const state = { needsMatch: [], status: "needs_refresh" };
    const fetchMock = stubMailroom(state);
    expect((await getNavMetrics()).psnNeedsRefresh).toBe(true);

    // Credential gets refreshed (as /psn's action would do) and the nav cache
    // is dropped — the next read must see the new status, not the cached one.
    state.status = "valid";
    invalidateNavMetrics();

    expect((await getNavMetrics()).psnNeedsRefresh).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4); // two more fetches after invalidate
  });
});
