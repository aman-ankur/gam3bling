import { describe, expect, test } from "vitest";
import { appConfig } from "./config";

describe("appConfig", () => {
  test("names the Gam3Bling app and first tournament", () => {
    expect(appConfig.name).toBe("Gam3Bling");
    expect(appConfig.supportedTournament).toBe("FIFA World Cup 2026");
  });
});
