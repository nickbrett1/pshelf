import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseNeedsMatch,
  parseIgdbCandidates,
  getNeedsMatch,
  igdbSearch,
  applyIgdbMatch,
  excludeNonGame,
  getPsnCredential,
  submitPsnCredential,
} from "../src/lib/server/api-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseNeedsMatch", () => {
  it("parses a bare array", () => {
    expect(
      parseNeedsMatch([
        { owned_game_id: 1, title: "Bloodborne", platform: "PS4" },
        { owned_game_id: 2, title: "Returnal" },
      ]),
    ).toEqual([
      { id: 1, title: "Bloodborne", platform: "PS4", format: null },
      { id: 2, title: "Returnal", platform: null, format: null },
    ]);
  });

  it("parses wrapped objects and skips rows without an id", () => {
    expect(
      parseNeedsMatch({
        items: [{ id: 5, name: "Sekiro" }, { title: "no id" }],
      }),
    ).toEqual([{ id: 5, title: "Sekiro", platform: null, format: null }]);
  });

  it("returns [] for empty/unknown shapes", () => {
    expect(parseNeedsMatch([])).toEqual([]);
    expect(parseNeedsMatch(null)).toEqual([]);
    expect(parseNeedsMatch({ foo: 1 })).toEqual([]);
  });
});

describe("parseIgdbCandidates", () => {
  it("parses candidates with year and cover", () => {
    const out = parseIgdbCandidates([
      {
        id: 10,
        name: "Bloodborne",
        first_release_date: "2015-03-24T00:00:00Z",
        cover: "http://x/bb.jpg",
      },
    ]);
    expect(out).toEqual([
      {
        igdb_id: 10,
        name: "Bloodborne",
        year: "2015",
        cover: "http://x/bb.jpg",
      },
    ]);
  });

  it("handles wrapped results and missing fields", () => {
    expect(
      parseIgdbCandidates({ results: [{ igdb_id: 3, title: "Sekiro" }] }),
    ).toEqual([{ igdb_id: 3, name: "Sekiro", year: null, cover: null }]);
    expect(parseIgdbCandidates({})).toEqual([]);
  });
});

describe("getNeedsMatch", () => {
  it("returns parsed games on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ owned_game_id: 7, title: "Hollow Knight" }],
      }),
    );
    expect(await getNeedsMatch()).toHaveLength(1);
  });

  it("returns [] on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );
    expect(await getNeedsMatch()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await getNeedsMatch()).toEqual([]);
  });
});

describe("igdbSearch", () => {
  it("posts to /igdb/search and parses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 1, name: "Bloodborne" }],
      }),
    );
    expect(await igdbSearch("Bloodborne")).toEqual([
      { igdb_id: 1, name: "Bloodborne", year: null, cover: null },
    ]);
  });

  it("returns [] on non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );
    expect(await igdbSearch("x")).toEqual([]);
  });
});

describe("applyIgdbMatch", () => {
  it("returns ok on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    expect(await applyIgdbMatch(1, 2)).toEqual({ ok: true });
  });

  it("returns error on non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "boom",
      }),
    );
    const res = await applyIgdbMatch(1, 2);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("boom");
  });
});

describe("getPsnCredential", () => {
  it("parses a valid status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "valid",
          last_success: "2026-01-01",
          expires_at: null,
        }),
      }),
    );
    expect(await getPsnCredential()).toMatchObject({
      status: "valid",
      last_success: "2026-01-01",
    });
  });

  it("falls back to needs_refresh on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const out = await getPsnCredential();
    expect(out.status).toBe("needs_refresh");
    expect(out.last_error).toContain("500");
  });
});

describe("submitPsnCredential", () => {
  it("posts npsso and returns ok on success", async () => {
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "valid", cookies_stored: true }),
    });
    vi.stubGlobal("fetch", fn);
    expect(await submitPsnCredential("np_abc")).toEqual({
      ok: true,
      status: "valid",
    });
    const [, opts] = fn.mock.calls[0];
    expect(opts.body).toContain("np_abc");
  });

  it("surfaces the API detail on a 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ detail: "NPSSO exchange failed: bad" }),
      }),
    );
    const res = await submitPsnCredential("bad");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("NPSSO exchange failed");
  });
});

describe("excludeNonGame", () => {
  it("flags unsupported on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    const res = await excludeNonGame(1);
    expect(res.ok).toBe(false);
    expect(res.unsupported).toBe(true);
  });

  it("returns ok on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    expect(await excludeNonGame(1)).toEqual({ ok: true });
  });
});
