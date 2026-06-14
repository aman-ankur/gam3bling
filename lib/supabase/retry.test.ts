import { expect, test } from "vitest";
import { isTransientSupabaseError, withSupabaseRetry } from "./retry";

test("retries transient Supabase fetch failures", async () => {
  let attempts = 0;

  const result = await withSupabaseRetry(
    async () => {
      attempts += 1;

      if (attempts < 3) {
        return { data: null, error: { message: "TypeError: fetch failed" } };
      }

      return { data: { id: "player-1" }, error: null };
    },
    { delayMs: 0 }
  );

  expect(result).toEqual({ data: { id: "player-1" }, error: null });
  expect(attempts).toBe(3);
});

test("does not retry database validation errors", async () => {
  let attempts = 0;

  const result = await withSupabaseRetry(
    async () => {
      attempts += 1;

      return { data: null, error: { message: "violates check constraint" } };
    },
    { delayMs: 0 }
  );

  expect(result).toEqual({ data: null, error: { message: "violates check constraint" } });
  expect(attempts).toBe(1);
});

test("recognizes connection reset errors as transient", () => {
  expect(isTransientSupabaseError({ message: "read ECONNRESET" })).toBe(true);
});
