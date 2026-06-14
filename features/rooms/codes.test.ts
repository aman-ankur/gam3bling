import { expect, test } from "vitest";
import { isValidInviteCode, normalizeInviteCode } from "./codes";

test("normalizes invite codes", () => {
  expect(normalizeInviteCode(" tiger7 ")).toBe("TIGER7");
});

test("validates short invite codes", () => {
  expect(isValidInviteCode("TIGER7")).toBe(true);
  expect(isValidInviteCode("NO")).toBe(false);
  expect(isValidInviteCode("TOO-LONG-CODE")).toBe(false);
});
