import { beforeEach, expect, test, vi } from "vitest";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { setPlayerSession } from "@/features/players/session";
import { claimRoomPlayer, joinRoom } from "./actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  })
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn()
}));

vi.mock("@/lib/supabase/retry", () => ({
  withSupabaseRetry: vi.fn(async (operation: () => Promise<unknown>) => operation())
}));

vi.mock("@/features/players/identity", () => ({
  initialsFromName: vi.fn((displayName: string) => displayName.trim().slice(0, 2).toUpperCase()),
  normalizeDisplayName: vi.fn((displayName: string) => displayName.trim().replace(/\s+/g, " "))
}));

vi.mock("@/features/players/session", () => {
  return {
    hashSecret: vi.fn((value: string) =>
      value === "TIGER7" ? "67985328ad86808121da46742ba759123b6e7bc1dae81edaeb39747d5b672302" : `hash:${value}`
    ),
    setPlayerSession: vi.fn()
  };
});

vi.mock("@/features/rooms/codes", () => ({
  isValidInviteCode: vi.fn((inviteCode: string) => /^[A-Z0-9]{4,10}$/.test(inviteCode.trim().toUpperCase())),
  normalizeInviteCode: vi.fn((inviteCode: string) => inviteCode.trim().toUpperCase())
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("warns before creating a duplicate room member with the same display name", async () => {
  const insertPlayer = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: "new-player" }, error: null }))
    }))
  }));
  const upsertMember = vi.fn(async () => ({ error: null }));
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "rooms") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "room-1",
                  slug: "world-cup-room",
                  invite_code_hash: "67985328ad86808121da46742ba759123b6e7bc1dae81edaeb39747d5b672302"
                },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "room_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    player_id: "existing-player",
                    joined_at: "2026-06-14T12:00:00.000Z",
                    players: { display_name: "Amanwa", avatar_initials: "A" }
                  }
                ],
                error: null
              }))
            }))
          })),
          upsert: upsertMember
        };
      }

      if (table === "players") {
        return {
          insert: insertPlayer
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("inviteCode", "TIGER7");
  formData.set("displayName", " amanwa ");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(joinRoom("world-cup-room", formData)).rejects.toThrow(
    "NEXT_REDIRECT:/r/world-cup-room?invite=TIGER7&claimPlayerId=existing-player&claimName=Amanwa"
  );

  expect(insertPlayer).not.toHaveBeenCalled();
  expect(upsertMember).not.toHaveBeenCalled();
  expect(setPlayerSession).not.toHaveBeenCalled();
  expect(redirect).toHaveBeenCalledWith(
    "/r/world-cup-room?invite=TIGER7&claimPlayerId=existing-player&claimName=Amanwa"
  );
});

test("claiming an existing room member restores that player session", async () => {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "rooms") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: "room-1",
                  slug: "world-cup-room",
                  invite_code_hash: "67985328ad86808121da46742ba759123b6e7bc1dae81edaeb39747d5b672302"
                },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "room_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { player_id: "existing-player" }, error: null }))
              }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("inviteCode", "TIGER7");
  formData.set("playerId", "existing-player");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(claimRoomPlayer("world-cup-room", formData)).rejects.toThrow(
    "NEXT_REDIRECT:/r/world-cup-room/matches"
  );

  expect(setPlayerSession).toHaveBeenCalledWith({
    playerId: "existing-player",
    roomId: "room-1",
    roomSlug: "world-cup-room"
  });
});
