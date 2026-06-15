import { beforeEach, expect, test, vi } from "vitest";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getPlayerSessionForRoom, removePlayerSessionForRoom, setPlayerSession } from "@/features/players/session";
import { claimRoomPlayer, createRoom, deleteRoom, joinRoom, rememberRoomInviteCode, removeRoomMember } from "./actions";

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
    getPlayerSessionForRoom: vi.fn(async () => null),
    hashSecret: vi.fn((value: string) =>
      value === "TIGER7" ? "67985328ad86808121da46742ba759123b6e7bc1dae81edaeb39747d5b672302" : `hash:${value}`
    ),
    removePlayerSessionForRoom: vi.fn(),
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

test("creating a room stores the visible invite code for later sharing", async () => {
  let roomInsertPayload: { invite_code?: string; invite_code_hash?: string } | null = null;
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "players") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "player-1" }, error: null }))
            }))
          }))
        };
      }

      if (table === "rooms") {
        return {
          insert: vi.fn((payload: { invite_code?: string; invite_code_hash?: string }) => {
            roomInsertPayload = payload;

            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: "room-1" }, error: null }))
              }))
            };
          })
        };
      }

      if (table === "room_members") {
        return {
          insert: vi.fn(async () => ({ error: null }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("roomName", "World Cup Room");
  formData.set("displayName", "Amanwa");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(createRoom(formData)).rejects.toThrow(/NEXT_REDIRECT:\/r\/world-cup-room-[a-f0-9]{4}\?invite=[A-Z0-9]{6}/);

  expect(roomInsertPayload?.invite_code).toMatch(/^[A-Z0-9]{6}$/);
  expect(roomInsertPayload?.invite_code_hash).toBe(`hash:${roomInsertPayload?.invite_code}`);
});

test("creating a room still works before the visible invite code migration is applied", async () => {
  const roomInsertPayloads: Array<{ invite_code?: string; invite_code_hash?: string }> = [];
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "players") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "player-1" }, error: null }))
            }))
          }))
        };
      }

      if (table === "rooms") {
        return {
          insert: vi.fn((payload: { invite_code?: string; invite_code_hash?: string }) => {
            roomInsertPayloads.push(payload);

            return {
              select: vi.fn(() => ({
                single: vi.fn(async () =>
                  roomInsertPayloads.length === 1
                    ? {
                        data: null,
                        error: { message: "Could not find the 'invite_code' column of 'rooms' in the schema cache" }
                      }
                    : { data: { id: "room-1" }, error: null }
                )
              }))
            };
          })
        };
      }

      if (table === "room_members") {
        return {
          insert: vi.fn(async () => ({ error: null }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("roomName", "World Cup Room");
  formData.set("displayName", "Amanwa");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(createRoom(formData)).rejects.toThrow(/NEXT_REDIRECT:\/r\/world-cup-room-[a-f0-9]{4}\?invite=[A-Z0-9]{6}/);

  expect(roomInsertPayloads).toHaveLength(2);
  expect(roomInsertPayloads[0]?.invite_code).toMatch(/^[A-Z0-9]{6}$/);
  expect(roomInsertPayloads[1]?.invite_code).toBeUndefined();
  expect(roomInsertPayloads[1]?.invite_code_hash).toBe(roomInsertPayloads[0]?.invite_code_hash);
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
                    player_id: "existing-old",
                    joined_at: "2026-06-14T10:00:00.000Z",
                    players: { display_name: "Amanwa", avatar_initials: "A" }
                  },
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

      if (table === "predictions") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    player_id: "existing-player",
                    submitted_at: "2026-06-14T15:00:00.000Z"
                  },
                  {
                    player_id: "existing-old",
                    submitted_at: "2026-06-14T13:00:00.000Z"
                  }
                ],
                error: null
              }))
            }))
          }))
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

test("joining a legacy room saves the visible invite code", async () => {
  const updateRoom = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null }))
  }));
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
                  invite_code: null,
                  invite_code_hash: "67985328ad86808121da46742ba759123b6e7bc1dae81edaeb39747d5b672302"
                },
                error: null
              }))
            }))
          })),
          update: updateRoom
        };
      }

      if (table === "room_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: [], error: null }))
            }))
          })),
          upsert: vi.fn(async () => ({ error: null }))
        };
      }

      if (table === "players") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "player-1" }, error: null }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("inviteCode", "tiger7");
  formData.set("displayName", "Kamesh");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(joinRoom("world-cup-room", formData)).rejects.toThrow("NEXT_REDIRECT:/r/world-cup-room/matches");

  expect(updateRoom).toHaveBeenCalledWith({ invite_code: "TIGER7" });
});

test("joining a room still works before the visible invite code migration is applied", async () => {
  let roomSelectCalls = 0;
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "rooms") {
        return {
          select: vi.fn(() => {
            roomSelectCalls += 1;

            return {
              eq: vi.fn(() => ({
                single: vi.fn(async () =>
                  roomSelectCalls === 1
                    ? {
                        data: null,
                        error: { message: "Could not find the 'invite_code' column of 'rooms' in the schema cache" }
                      }
                    : {
                        data: {
                          id: "room-1",
                          slug: "world-cup-room",
                          invite_code_hash: "67985328ad86808121da46742ba759123b6e7bc1dae81edaeb39747d5b672302"
                        },
                        error: null
                      }
                )
              }))
            };
          })
        };
      }

      if (table === "room_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: [], error: null }))
            }))
          })),
          upsert: vi.fn(async () => ({ error: null }))
        };
      }

      if (table === "players") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "player-1" }, error: null }))
            }))
          }))
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("inviteCode", "TIGER7");
  formData.set("displayName", "Kamesh");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(joinRoom("world-cup-room", formData)).rejects.toThrow("NEXT_REDIRECT:/r/world-cup-room/matches");

  expect(roomSelectCalls).toBe(2);
});

test("remembering a legacy room code verifies and stores the code", async () => {
  const updateRoom = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null }))
  }));
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
                  invite_code: null,
                  invite_code_hash: "67985328ad86808121da46742ba759123b6e7bc1dae81edaeb39747d5b672302"
                },
                error: null
              }))
            }))
          })),
          update: updateRoom
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("inviteCode", "tiger7");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);

  await expect(rememberRoomInviteCode("world-cup-room", formData)).rejects.toThrow(
    "NEXT_REDIRECT:/r/world-cup-room?hub=1&invite=TIGER7"
  );

  expect(updateRoom).toHaveBeenCalledWith({ invite_code: "TIGER7" });
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

test("room creator can remove another player from their room", async () => {
  const deleteMember = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null }))
    }))
  }));
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
                  creator_player_id: "admin-player"
                },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "room_members") {
        return {
          delete: deleteMember
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("playerId", "member-player");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
  vi.mocked(getPlayerSessionForRoom).mockResolvedValue({
    playerId: "admin-player",
    roomId: "room-1",
    roomSlug: "world-cup-room"
  });

  await expect(removeRoomMember("world-cup-room", formData)).rejects.toThrow(
    "NEXT_REDIRECT:/r/world-cup-room?hub=1&admin=playerRemoved"
  );

  expect(deleteMember).toHaveBeenCalled();
});

test("non-creators cannot remove room members", async () => {
  const deleteMember = vi.fn();
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
                  creator_player_id: "admin-player"
                },
                error: null
              }))
            }))
          }))
        };
      }

      if (table === "room_members") {
        return {
          delete: deleteMember
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };
  const formData = new FormData();
  formData.set("playerId", "member-player");

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
  vi.mocked(getPlayerSessionForRoom).mockResolvedValue({
    playerId: "member-player",
    roomId: "room-1",
    roomSlug: "world-cup-room"
  });

  await expect(removeRoomMember("world-cup-room", formData)).rejects.toThrow(
    "NEXT_REDIRECT:/r/world-cup-room?hub=1&adminError=permission"
  );

  expect(deleteMember).not.toHaveBeenCalled();
});

test("room creator can delete the room", async () => {
  const deleteRoomRecord = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null }))
  }));
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
                  creator_player_id: "admin-player"
                },
                error: null
              }))
            }))
          })),
          delete: deleteRoomRecord
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };

  vi.mocked(getSupabaseAdmin).mockReturnValue(supabase as never);
  vi.mocked(getPlayerSessionForRoom).mockResolvedValue({
    playerId: "admin-player",
    roomId: "room-1",
    roomSlug: "world-cup-room"
  });

  await expect(deleteRoom("world-cup-room")).rejects.toThrow("NEXT_REDIRECT:/?roomDeleted=world-cup-room");

  expect(deleteRoomRecord).toHaveBeenCalled();
  expect(removePlayerSessionForRoom).toHaveBeenCalledWith("room-1");
});
