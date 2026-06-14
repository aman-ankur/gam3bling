import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";
import { getSupabaseAdmin } from "../../../../lib/supabase/server";
import { syncMatches } from "../../../../features/sync/sync-matches";

vi.mock("../../../../lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("../../../../features/sync/sync-matches", () => ({
  syncMatches: vi.fn()
}));

describe("POST /api/sync/football", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SYNC_JOB_SECRET = "secret";
  });

  test("rejects requests without the sync secret", async () => {
    const response = await POST(new NextRequest("http://localhost/api/sync/football", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(syncMatches).not.toHaveBeenCalled();
  });

  test("runs football sync for authorized requests", async () => {
    const supabase = { from: vi.fn() };

    vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
    vi.mocked(syncMatches).mockResolvedValue({
      fetchedMatches: 1,
      updatedMatches: 1,
      scoredPredictions: 1,
      skippedMatches: 0
    });

    const response = await POST(
      new NextRequest("http://localhost/api/sync/football", {
        method: "POST",
        headers: {
          "x-sync-secret": "secret"
        }
      })
    );

    await expect(response.json()).resolves.toEqual({
      fetchedMatches: 1,
      updatedMatches: 1,
      scoredPredictions: 1,
      skippedMatches: 0
    });
    expect(syncMatches).toHaveBeenCalledWith({ supabase });
  });
});
