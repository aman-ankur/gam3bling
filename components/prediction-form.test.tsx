import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PredictionForm } from "@/components/prediction-form";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const homeTeam = {
  id: "home",
  name: "Brazil",
  shortCode: "BRA",
  flagCode: "BR"
};

const awayTeam = {
  id: "away",
  name: "Japan",
  shortCode: "JPN",
  flagCode: "JP"
};

describe("PredictionForm", () => {
  test("shows penalty score inputs for knockout draws", () => {
    const markup = renderToStaticMarkup(
      <PredictionForm
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        initialPrediction={{
          finalHomeScore: 1,
          finalAwayScore: 1,
          penaltyHomeScore: 5,
          penaltyAwayScore: 4
        }}
        stage="Round of 32"
      />
    );

    expect(markup).toContain("Penalty score");
    expect(markup).toContain("name=\"penaltyHomeScore\"");
    expect(markup).toContain("name=\"penaltyAwayScore\"");
  });

  test("hides penalty score inputs for knockout non-draw predictions", () => {
    const markup = renderToStaticMarkup(
      <PredictionForm
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        initialPrediction={{
          finalHomeScore: 2,
          finalAwayScore: 1
        }}
        stage="Round of 32"
      />
    );

    expect(markup).not.toContain("Penalty score");
  });
});
