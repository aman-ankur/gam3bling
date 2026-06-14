import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("match details migration", () => {
  const sql = readFileSync(join(process.cwd(), "db/migrations/0002_match_details.sql"), "utf8");

  test("creates match-scoped cache tables", () => {
    expect(sql).toContain("create table match_details");
    expect(sql).toContain("create table match_lineups");
    expect(sql).toContain("create table match_lineup_players");
    expect(sql).toContain("create table match_team_statistics");
  });

  test("keeps cached lineups and stats unique per match", () => {
    expect(sql).toContain("constraint match_lineups_match_team_unique unique (match_id, team_id)");
    expect(sql).toContain("constraint match_team_statistics_match_team_stat_unique unique (match_id, team_id, stat_name)");
  });

  test("constrains provider cache statuses and player roles", () => {
    expect(sql).toContain("constraint match_details_status_check");
    expect(sql).toContain("constraint match_details_lineups_status_check");
    expect(sql).toContain("constraint match_details_stats_status_check");
    expect(sql).toContain("constraint match_lineup_players_role_check");
  });
});
