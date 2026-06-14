import { expect, test } from "vitest";
import { initialsFromName, normalizeDisplayName } from "./identity";

test("normalizes display names", () => {
  expect(normalizeDisplayName("  John   Sharma ")).toBe("John Sharma");
});

test("creates initials from display name", () => {
  expect(initialsFromName("John Sharma")).toBe("JS");
  expect(initialsFromName("Rhea")).toBe("R");
});
