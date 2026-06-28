"use client";

import { useMemo, useState } from "react";
import { ScoringGuide } from "@/components/scoring-guide";
import { SubmitButton } from "@/components/submit-button";
import { TeamName } from "@/components/team-name";

type PredictionFormProps = {
  action?: (formData: FormData) => void | Promise<void>;
  homeTeam: {
    flagCode?: string | null;
    id: string;
    name: string;
    shortCode?: string;
  };
  awayTeam: {
    flagCode?: string | null;
    id: string;
    name: string;
    shortCode?: string;
  };
  initialPrediction?: {
    finalHomeScore?: number;
    finalAwayScore?: number;
    halftimeHomeScore?: number;
    halftimeAwayScore?: number;
    penaltyHomeScore?: number | null;
    penaltyAwayScore?: number | null;
    firstScoringTeamId?: string;
    lastScoringTeamId?: string;
  };
  locked?: boolean;
  stage?: string;
};

export function PredictionForm({ action, awayTeam, homeTeam, initialPrediction, locked = false, stage }: PredictionFormProps) {
  const [finalHomeScore, setFinalHomeScore] = useState(String(initialPrediction?.finalHomeScore ?? 2));
  const [finalAwayScore, setFinalAwayScore] = useState(String(initialPrediction?.finalAwayScore ?? 1));
  const [halftimeHomeScore, setHalftimeHomeScore] = useState(String(initialPrediction?.halftimeHomeScore ?? 1));
  const [halftimeAwayScore, setHalftimeAwayScore] = useState(String(initialPrediction?.halftimeAwayScore ?? 0));
  const [penaltyHomeScore, setPenaltyHomeScore] = useState(String(initialPrediction?.penaltyHomeScore ?? 5));
  const [penaltyAwayScore, setPenaltyAwayScore] = useState(String(initialPrediction?.penaltyAwayScore ?? 4));
  const [firstScoringTeamId, setFirstScoringTeamId] = useState(initialPrediction?.firstScoringTeamId ?? homeTeam.id);
  const [lastScoringTeamId, setLastScoringTeamId] = useState(initialPrediction?.lastScoringTeamId ?? awayTeam.id);
  const finalHome = parseScore(finalHomeScore);
  const finalAway = parseScore(finalAwayScore);
  const derived = useMemo(
    () => derivePredictionState({
      awayTeamId: awayTeam.id,
      finalAway,
      finalHome,
      firstScoringTeamId,
      homeTeamId: homeTeam.id,
      lastScoringTeamId
    }),
    [awayTeam.id, finalAway, finalHome, firstScoringTeamId, homeTeam.id, lastScoringTeamId]
  );
  const showPenaltyScore = isKnockoutStage(stage) && derived.matchResult === "draw";
  const updateFinalHomeScore = (value: string) => {
    const nextFinalHome = parseScore(value);

    setFinalHomeScore(value);
    setHalftimeHomeScore((current) => String(Math.min(parseScore(current), nextFinalHome)));
  };
  const updateFinalAwayScore = (value: string) => {
    const nextFinalAway = parseScore(value);

    setFinalAwayScore(value);
    setHalftimeAwayScore((current) => String(Math.min(parseScore(current), nextFinalAway)));
  };

  return (
    <form action={action} className={locked ? "prediction-form locked" : "prediction-form"} aria-label="Prediction form">
      {locked ? <p className="locked-banner">Prediction locked</p> : null}
      <ScoringGuide />

      <section className="market-card" aria-labelledby="final-score-title">
        <h2 id="final-score-title">Final score</h2>
        <div className="score-grid">
          <label>
            <TeamName team={homeTeam} />
            <input
              aria-label={`${homeTeam.name} final score`}
              disabled={locked}
              inputMode="numeric"
              min={0}
              name="finalHomeScore"
              onChange={(event) => updateFinalHomeScore(event.target.value)}
              type="number"
              value={finalHomeScore}
            />
          </label>
          <label>
            <TeamName team={awayTeam} />
            <input
              aria-label={`${awayTeam.name} final score`}
              disabled={locked}
              inputMode="numeric"
              min={0}
              name="finalAwayScore"
              onChange={(event) => updateFinalAwayScore(event.target.value)}
              type="number"
              value={finalAwayScore}
            />
          </label>
        </div>
      </section>

      <section className="market-card" aria-labelledby="match-result-title">
        <h2 id="match-result-title">Match result</h2>
        <input name="matchResult" type="hidden" value={derived.matchResult} />
        <div className="segmented-control">
          <label className={derived.matchResult === "home" ? "segment-option selected" : "segment-option"}>
            <TeamName team={homeTeam} />
          </label>
          <label className={derived.matchResult === "draw" ? "segment-option selected" : "segment-option"}>
            Draw
          </label>
          <label className={derived.matchResult === "away" ? "segment-option selected" : "segment-option"}>
            <TeamName team={awayTeam} />
          </label>
        </div>
        <p className="helper-line">Auto-selected from final score</p>
      </section>

      {showPenaltyScore ? (
        <section className="market-card" aria-labelledby="penalty-score-title">
          <h2 id="penalty-score-title">Penalty score</h2>
          <div className="score-grid">
            <label>
              <TeamName team={homeTeam} />
              <input
                aria-label={`${homeTeam.name} penalty score`}
                disabled={locked}
                inputMode="numeric"
                min={0}
                name="penaltyHomeScore"
                onChange={(event) => setPenaltyHomeScore(event.target.value)}
                type="number"
                value={penaltyHomeScore}
              />
            </label>
            <label>
              <TeamName team={awayTeam} />
              <input
                aria-label={`${awayTeam.name} penalty score`}
                disabled={locked}
                inputMode="numeric"
                min={0}
                name="penaltyAwayScore"
                onChange={(event) => setPenaltyAwayScore(event.target.value)}
                type="number"
                value={penaltyAwayScore}
              />
            </label>
          </div>
        </section>
      ) : null}

      <section className="market-card" aria-labelledby="halftime-title">
        <h2 id="halftime-title">Half-time score</h2>
        <div className="score-grid">
          <label>
            <TeamName team={homeTeam} />
            <input
              aria-label={`${homeTeam.name} half-time score`}
              disabled={locked}
              inputMode="numeric"
              max={finalHome}
              min={0}
              name="halftimeHomeScore"
              onChange={(event) => setHalftimeHomeScore(String(Math.min(parseScore(event.target.value), finalHome)))}
              type="number"
              value={halftimeHomeScore}
            />
          </label>
          <label>
            <TeamName team={awayTeam} />
            <input
              aria-label={`${awayTeam.name} half-time score`}
              disabled={locked}
              inputMode="numeric"
              max={finalAway}
              min={0}
              name="halftimeAwayScore"
              onChange={(event) => setHalftimeAwayScore(String(Math.min(parseScore(event.target.value), finalAway)))}
              type="number"
              value={halftimeAwayScore}
            />
          </label>
        </div>
      </section>

      <TeamMarket
        awayCanScore={derived.awayCanScore}
        awayTeam={awayTeam}
        fieldName="firstScoringTeamId"
        homeCanScore={derived.homeCanScore}
        homeTeam={homeTeam}
        locked={locked || derived.scorersLocked}
        onChange={setFirstScoringTeamId}
        selected={derived.firstScoringTeamId}
        title="First team to score"
      />
      <TeamMarket
        awayCanScore={derived.awayCanScore}
        awayTeam={awayTeam}
        fieldName="lastScoringTeamId"
        homeCanScore={derived.homeCanScore}
        homeTeam={homeTeam}
        locked={locked || derived.scorersLocked}
        onChange={setLastScoringTeamId}
        selected={derived.lastScoringTeamId}
        title="Last team to score"
      />

      <SubmitButton disabled={locked} pendingLabel="Saving predictions...">Save predictions</SubmitButton>
    </form>
  );
}

function TeamMarket({
  awayTeam,
  awayCanScore,
  fieldName,
  homeCanScore,
  homeTeam,
  title,
  locked,
  onChange,
  selected
}: {
  awayTeam: { flagCode?: string | null; id: string; name: string; shortCode?: string };
  awayCanScore: boolean;
  fieldName: string;
  homeCanScore: boolean;
  homeTeam: { flagCode?: string | null; id: string; name: string; shortCode?: string };
  title: string;
  locked: boolean;
  onChange: (teamId: string) => void;
  selected: string;
}) {
  const noGoals = !homeCanScore && !awayCanScore;

  return (
    <section className="market-card" aria-labelledby={`${title.replaceAll(" ", "-").toLowerCase()}-title`}>
      <h2 id={`${title.replaceAll(" ", "-").toLowerCase()}-title`}>{title}</h2>
      {locked ? <input name={fieldName} type="hidden" value={selected} /> : null}
      <div className={noGoals ? "segmented-control three-up" : "segmented-control two-up"}>
        {[
          { ...homeTeam, canScore: homeCanScore },
          { ...awayTeam, canScore: awayCanScore }
        ].map((team) => (
          <label className="segment-option" key={team.id}>
            <input
              checked={team.id === selected}
              disabled={locked || !team.canScore}
              name={fieldName}
              onChange={() => onChange(team.id)}
              type="radio"
              value={team.id}
            />
            <TeamName team={team} />
          </label>
        ))}
        {noGoals ? (
          <label className="segment-option">
            <input checked disabled name={fieldName} readOnly type="radio" value="" />
            No goals
          </label>
        ) : null}
      </div>
    </section>
  );
}

function parseScore(value: string): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function isKnockoutStage(stage: string | undefined): boolean {
  return Boolean(stage && !stage.toLocaleLowerCase().startsWith("group"));
}

function derivePredictionState({
  awayTeamId,
  finalAway,
  finalHome,
  firstScoringTeamId,
  homeTeamId,
  lastScoringTeamId
}: {
  awayTeamId: string;
  finalAway: number;
  finalHome: number;
  firstScoringTeamId: string;
  homeTeamId: string;
  lastScoringTeamId: string;
}) {
  const matchResult = finalHome > finalAway ? "home" : finalAway > finalHome ? "away" : "draw";
  const homeCanScore = finalHome > 0;
  const awayCanScore = finalAway > 0;
  const scorersLocked = !homeCanScore || !awayCanScore;

  return {
    awayCanScore,
    firstScoringTeamId: normalizeScorer(firstScoringTeamId, homeTeamId, awayTeamId, homeCanScore, awayCanScore),
    homeCanScore,
    lastScoringTeamId: normalizeScorer(lastScoringTeamId, homeTeamId, awayTeamId, homeCanScore, awayCanScore),
    matchResult,
    scorersLocked
  };
}

function normalizeScorer(
  selectedTeamId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeCanScore: boolean,
  awayCanScore: boolean
): string {
  if (!homeCanScore && !awayCanScore) {
    return "";
  }

  if (homeCanScore && !awayCanScore) {
    return homeTeamId;
  }

  if (!homeCanScore && awayCanScore) {
    return awayTeamId;
  }

  return selectedTeamId === homeTeamId || selectedTeamId === awayTeamId ? selectedTeamId : homeTeamId;
}
