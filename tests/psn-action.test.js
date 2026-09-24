import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/server/api-client.js", () => ({
  getPsnCredential: vi.fn(),
  submitPsnCredential: vi.fn(),
}));
vi.mock("$lib/server/nav-metrics.js", () => ({
  invalidateNavMetrics: vi.fn(),
}));

import { actions } from "../src/routes/psn/+page.server.js";
import {
  getPsnCredential,
  submitPsnCredential,
} from "$lib/server/api-client.js";
import { invalidateNavMetrics } from "$lib/server/nav-metrics.js";

function requestWithNpsso(npsso) {
  const fd = new FormData();
  if (npsso != null) fd.set("npsso", npsso);
  return new Request("http://localhost/psn?/refresh", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/psn refresh action", () => {
  it("rejects an empty NPSSO without calling mailroom", async () => {
    const result = await actions.refresh({ request: requestWithNpsso("  ") });
    expect(result.status).toBe(400);
    expect(result.data.error).toMatch(/paste an npsso/i);
    expect(submitPsnCredential).not.toHaveBeenCalled();
  });

  it("returns the verified status and clears the nav cache on success", async () => {
    submitPsnCredential.mockResolvedValue({ ok: true, status: "valid" });
    getPsnCredential.mockResolvedValue({ status: "valid", last_error: null });

    const result = await actions.refresh({
      request: requestWithNpsso("np_good"),
    });

    expect(result).toMatchObject({ ok: true });
    expect(result.status.status).toBe("valid");
    expect(invalidateNavMetrics).toHaveBeenCalledOnce();
  });

  it("does NOT claim success when the exchange 200s but the credential is still not valid", async () => {
    submitPsnCredential.mockResolvedValue({ ok: true, status: "valid" });
    getPsnCredential.mockResolvedValue({
      status: "needs_refresh",
      last_error: "refresh token rejected (invalid_grant)",
    });

    const result = await actions.refresh({
      request: requestWithNpsso("np_good"),
    });

    expect(result.status).toBe(502);
    expect(result.data.error).toMatch(/still not valid/i);
    expect(result.data.error).toContain("invalid_grant");
    expect(result.data.status.status).toBe("needs_refresh");
    expect(invalidateNavMetrics).not.toHaveBeenCalled();
  });

  it("surfaces mailroom's error and does not clear the nav cache on rejection", async () => {
    submitPsnCredential.mockResolvedValue({
      ok: false,
      error: "NPSSO exchange failed: bad token",
    });
    getPsnCredential.mockResolvedValue({
      status: "needs_refresh",
      last_error: "exchange failed: bad token",
    });

    const result = await actions.refresh({
      request: requestWithNpsso("np_bad"),
    });

    expect(result.status).toBe(502);
    expect(result.data.error).toContain("NPSSO exchange failed");
    expect(result.data.status.status).toBe("needs_refresh");
    expect(invalidateNavMetrics).not.toHaveBeenCalled();
  });
});
