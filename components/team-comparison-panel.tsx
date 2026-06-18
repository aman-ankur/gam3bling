"use client";

import { useState } from "react";
import { TeamName } from "@/components/team-name";
import type { AppMatch } from "@/features/matches/data";
import { buildTeamComparison } from "@/features/teams/team-comparison";

type TeamComparisonPanelProps = {
  defaultOpen?: boolean;
  match: AppMatch;
  matches: AppMatch[];
  mode?: "collapsible" | "static";
};

export function TeamComparisonPanel({ defaultOpen = false, match, matches, mode = "collapsible" }: TeamComparisonPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const comparison = buildTeamComparison(match, matches);
  const isStatic = mode === "static";
  const isOpen = isStatic || open;

  return (
    <section className={isOpen ? "team-comparison-panel open" : "team-comparison-panel"} id="team-comparison">
      {isStatic ? null : (
        <button
          aria-controls="team-comparison-body"
          aria-expanded={open}
          className="team-comparison-trigger"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span>
            <span className="eyebrow">Before you bet</span>
            <b>Team comparison</b>
            <small>Rank, World Cup points, and record</small>
          </span>
          <strong>{open ? "Hide" : "Compare"}</strong>
        </button>
      )}

      {isOpen ? <div className="team-comparison-body" id="team-comparison-body">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Decision check</p>
            <h2>Team comparison</h2>
          </div>
          <span className="status-chip">Preloaded</span>
        </div>

        <p className="section-note">Use seeded team profiles plus current tournament form before placing your prediction.</p>

        <div className="comparison-scoreboard">
          <div className="comparison-team">
            <TeamName team={match.homeTeam} />
            <strong aria-label={`${match.homeTeam.name} ranking value`}>{rankLabel(match.homeTeam.fifaRank)}</strong>
          </div>
          <span>vs</span>
          <div className="comparison-team">
            <TeamName team={match.awayTeam} />
            <strong aria-label={`${match.awayTeam.name} ranking value`}>{rankLabel(match.awayTeam.fifaRank)}</strong>
          </div>
        </div>

        <div className="comparison-grid" aria-label={`${match.homeTeam.name} and ${match.awayTeam.name} comparison stats`}>
          <ComparisonRow
            awayValue={rankLabel(match.awayTeam.fifaRank)}
            homeValue={rankLabel(match.homeTeam.fifaRank)}
            label="World ranking"
          />
          <ComparisonRow
            awayValue={`${comparison.awaySummary.points}`}
            homeValue={`${comparison.homeSummary.points}`}
            label="Current WC points"
          />
          <ComparisonRow
            awayValue={recordLabel(comparison.awaySummary)}
            homeValue={recordLabel(comparison.homeSummary)}
            label="World Cup record"
          />
          <ComparisonRow
            awayValue={goalDifferenceLabel(comparison.awaySummary.goalDifference)}
            homeValue={goalDifferenceLabel(comparison.homeSummary.goalDifference)}
            label="Goal difference"
          />
          <ComparisonRow
            awayValue={comparison.awaySummary.played ? `${comparison.awaySummary.played}` : "0"}
            homeValue={comparison.homeSummary.played ? `${comparison.homeSummary.played}` : "0"}
            label="Matches played"
          />
          <ComparisonRow
            awayValue={comparison.awayProfile?.worldCupBest ?? "Pending"}
            homeValue={comparison.homeProfile?.worldCupBest ?? "Pending"}
            label="World Cup best"
          />
          <ComparisonRow
            awayValue={comparison.awayProfile?.confederation ?? "Pending"}
            homeValue={comparison.homeProfile?.confederation ?? "Pending"}
            label="Region"
          />
        </div>

        <div className="comparison-nudge">
          <span>Ranking gap</span>
          <b>{comparison.rankingGap == null ? "Unknown" : `${comparison.rankingGap} places`}</b>
          <small>
            {comparison.rankingLeader ? `${comparison.rankingLeader.name} have the ranking edge.` : "Ranking edge unavailable."}
            {" "}
            Profiles refresh with the page; tournament points update when match results sync.
          </small>
        </div>
      </div> : null}
    </section>
  );
}

function ComparisonRow({ awayValue, homeValue, label }: { awayValue: string; homeValue: string; label: string }) {
  return (
    <div className="comparison-row">
      <b>{homeValue}</b>
      <span>{label}</span>
      <b>{awayValue}</b>
    </div>
  );
}

function rankLabel(rank: number | null | undefined): string {
  return rank ? `#${rank}` : "-";
}

function recordLabel(summary: { draws: number; losses: number; wins: number }): string {
  return `${summary.wins}W ${summary.draws}D ${summary.losses}L`;
}

function goalDifferenceLabel(goalDifference: number): string {
  if (goalDifference > 0) {
    return `+${goalDifference}`;
  }

  return `${goalDifference}`;
}
