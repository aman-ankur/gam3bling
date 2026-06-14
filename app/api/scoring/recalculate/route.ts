import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { scorePrediction } from "@/features/scoring/score-prediction";

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .not("home_score", "is", null)
    .not("away_score", "is", null);

  if (matchError) {
    await logSync("failed", matchError.message);
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  let updatedPredictions = 0;

  for (const match of matches ?? []) {
    const { data: predictions, error: predictionError } = await supabase
      .from("predictions")
      .select("*")
      .eq("match_id", match.id);

    if (predictionError) {
      await logSync("failed", predictionError.message);
      return NextResponse.json({ error: predictionError.message }, { status: 500 });
    }

    for (const prediction of predictions ?? []) {
      const score = scorePrediction(
        {
          finalHomeScore: prediction.final_home_score,
          finalAwayScore: prediction.final_away_score,
          matchResult: prediction.match_result,
          halftimeHomeScore: prediction.halftime_home_score,
          halftimeAwayScore: prediction.halftime_away_score,
          firstScoringTeamId: prediction.first_scoring_team_id,
          lastScoringTeamId: prediction.last_scoring_team_id
        },
        {
          homeScore: match.home_score,
          awayScore: match.away_score,
          halftimeHomeScore: match.home_halftime_score,
          halftimeAwayScore: match.away_halftime_score,
          winner: match.winner,
          firstScoringTeamId: match.first_scoring_team_id,
          lastScoringTeamId: match.last_scoring_team_id
        }
      );

      const { error: updateError } = await supabase
        .from("predictions")
        .update({
          score_final: score.scoreFinal,
          score_result: score.scoreResult,
          score_halftime: score.scoreHalftime,
          score_first_scorer: score.scoreFirstScorer,
          score_last_scorer: score.scoreLastScorer,
          score_total: score.scoreTotal,
          scored_at: new Date().toISOString()
        })
        .eq("id", prediction.id);

      if (updateError) {
        await logSync("failed", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      updatedPredictions += 1;
    }
  }

  await logSync("success", `Updated ${updatedPredictions} predictions`);
  return NextResponse.json({ updatedPredictions });
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.SYNC_JOB_SECRET;

  if (!secret) {
    return false;
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-sync-secret");

  return bearer === secret || headerSecret === secret;
}

async function logSync(status: "success" | "failed", message: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return;
  }

  await supabase.from("sync_logs").insert({
    provider: "manual",
    sync_type: "scoring_recalculate",
    status,
    message
  });
}
