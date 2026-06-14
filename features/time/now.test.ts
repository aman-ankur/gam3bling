import { afterEach, expect, test } from "vitest";
import { getCurrentDate } from "./now";

afterEach(() => {
  delete process.env.E2E_USE_FALLBACK_FIXTURES;
  delete process.env.E2E_NOW;
});

test("uses real current time outside e2e fallback mode", () => {
  process.env.E2E_NOW = "2026-06-14T19:45:00Z";

  expect(getCurrentDate().toISOString()).not.toBe("2026-06-14T19:45:00.000Z");
});

test("uses a deterministic clock in e2e fallback mode", () => {
  process.env.E2E_USE_FALLBACK_FIXTURES = "1";
  process.env.E2E_NOW = "2026-06-14T19:45:00Z";

  expect(getCurrentDate().toISOString()).toBe("2026-06-14T19:45:00.000Z");
});
