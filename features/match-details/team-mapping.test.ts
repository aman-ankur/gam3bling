import { describe, expect, test } from "vitest";
import { resolveLocalTeamIdFromProviderName } from "./team-mapping";

describe("resolveLocalTeamIdFromProviderName", () => {
  test("uses provider home/away side before matching provider names", () => {
    expect(resolveLocalTeamIdFromProviderName({
      providerTeamName: "Any provider label",
      providerTeamSide: "away",
      homeTeam: { id: "team-por", name: "Portugal" },
      awayTeam: { id: "team-cod", name: "DR Congo" }
    })).toBe("team-cod");
  });

  test("maps ESPN Congo DR naming to the local DR Congo team", () => {
    expect(resolveLocalTeamIdFromProviderName({
      providerTeamName: "Congo DR",
      homeTeam: { id: "team-por", name: "Portugal" },
      awayTeam: { id: "team-cod", name: "DR Congo" }
    })).toBe("team-cod");
  });

  test("maps common provider aliases for seeded team names", () => {
    expect(resolveLocalTeamIdFromProviderName({
      providerTeamName: "Côte d'Ivoire",
      homeTeam: { id: "team-civ", name: "Ivory Coast" },
      awayTeam: { id: "team-ecu", name: "Ecuador" }
    })).toBe("team-civ");

    expect(resolveLocalTeamIdFromProviderName({
      providerTeamName: "Turkey",
      homeTeam: { id: "team-aus", name: "Australia" },
      awayTeam: { id: "team-tur", name: "Turkiye" }
    })).toBe("team-tur");
  });
});
