#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const TOURNAMENT_ID = "11111111-1111-4111-8111-111111111111";
const DAY_MS = 24 * 60 * 60 * 1000;

const TEAM_OVERRIDES = {
  BIH: { name: "Bosnia-Herzegovina", flagCode: "BA" },
  CIV: { name: "Ivory Coast", flagCode: "CI" },
  COD: { name: "DR Congo", flagCode: "CD" },
  CPV: { name: "Cape Verde", flagCode: "CV" },
  ENG: { name: "England", flagCode: "GB-ENG" },
  MAR: { name: "Morocco", flagCode: "MA" },
  PAR: { name: "Paraguay", flagCode: "PY" },
  RSA: { name: "South Africa", flagCode: "ZA" },
  SUI: { name: "Switzerland", flagCode: "CH" },
  USA: { name: "United States", flagCode: "US" }
};

const FLAG_BY_CODE = {
  ARG: "AR",
  ALG: "DZ",
  AUS: "AU",
  AUT: "AT",
  BEL: "BE",
  BRA: "BR",
  CAN: "CA",
  COL: "CO",
  ECU: "EC",
  EGY: "EG",
  ESP: "ES",
  FRA: "FR",
  GER: "DE",
  GHA: "GH",
  JPN: "JP",
  MEX: "MX",
  NED: "NL",
  NOR: "NO",
  POR: "PT",
  SEN: "SN",
  SWE: "SE"
};

const { days, start } = parseArgs(process.argv.slice(2));
const env = readEnvFile(".env.local");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const events = await fetchEvents(start, days);
const r32Events = events.filter((event) => event.season?.slug === "round-of-32").filter(hasRealTeams);
const { data: existingTeams, error: teamError } = await withRetry(() =>
  supabase
    .from("teams")
    .select("id, name, short_code, flag_code")
);

if (teamError) {
  throw teamError;
}

const { data: existingMatches, error: matchError } = await withRetry(() =>
  supabase
    .from("matches")
    .select("id, kickoff_at, api_match_id, home:teams!matches_home_team_id_fkey(short_code), away:teams!matches_away_team_id_fkey(short_code)")
);

if (matchError) {
  throw matchError;
}

const teamByCode = new Map((existingTeams ?? []).map((team) => [team.short_code, team]));
const matchByEventId = new Map((existingMatches ?? []).map((match) => [match.api_match_id, match]));
const matchByKickoffAndTeams = new Map((existingMatches ?? []).map((match) => [
  matchKey(match.kickoff_at, match.home?.short_code, match.away?.short_code),
  match
]));
const teamsToInsert = [];
const matchesToUpsert = [];

for (const event of r32Events) {
  ensureTeam(competitorBySide(event, "home")?.team, teamByCode, teamsToInsert);
  ensureTeam(competitorBySide(event, "away")?.team, teamByCode, teamsToInsert);
}

if (teamsToInsert.length > 0) {
  const { data: insertedTeams, error } = await withRetry(() =>
    supabase
      .from("teams")
      .insert(teamsToInsert)
      .select("id, name, short_code, flag_code")
  );

  if (error) {
    throw error;
  }

  for (const team of insertedTeams ?? []) {
    teamByCode.set(team.short_code, team);
  }
}

for (const event of r32Events) {
  const home = competitorBySide(event, "home")?.team;
  const away = competitorBySide(event, "away")?.team;
  const homeTeam = teamByCode.get(home.abbreviation);
  const awayTeam = teamByCode.get(away.abbreviation);
  const existingMatch = matchByEventId.get(String(event.id))
    ?? matchByKickoffAndTeams.get(matchKey(event.date, home.abbreviation, away.abbreviation));

  if (!homeTeam || !awayTeam) {
    continue;
  }

  matchesToUpsert.push({
    id: existingMatch?.id ?? uuidFromNumeric("30000000", event.id),
    tournament_id: TOURNAMENT_ID,
    home_team_id: homeTeam.id,
    away_team_id: awayTeam.id,
    kickoff_at: event.date,
    stage: "Round of 32",
    group_name: null,
    status: normalizeStatus(event.status?.type),
    home_score: null,
    away_score: null,
    home_halftime_score: null,
    away_halftime_score: null,
    winner: null,
    first_scoring_team_id: null,
    last_scoring_team_id: null,
    api_provider: "espn",
    api_match_id: String(event.id),
    updated_at: new Date().toISOString()
  });
}

if (matchesToUpsert.length > 0) {
  const { error } = await withRetry(() =>
    supabase
      .from("matches")
      .upsert(matchesToUpsert, { onConflict: "id" })
  );

  if (error) {
    throw error;
  }
}

console.log(JSON.stringify({
  start,
  days,
  fetchedEvents: events.length,
  roundOf32Events: r32Events.length,
  teamsInserted: teamsToInsert.length,
  matchesUpserted: matchesToUpsert.length,
  fixtures: matchesToUpsert.map((match) => ({
    apiMatchId: match.api_match_id,
    kickoffUtc: match.kickoff_at,
    kickoffIst: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata"
    }).format(new Date(match.kickoff_at))
  }))
}, null, 2));

function parseArgs(args) {
  const startArg = args.find((arg) => arg.startsWith("--start="))?.slice("--start=".length) ?? "2026-06-28";
  const daysArg = args.find((arg) => arg.startsWith("--days="))?.slice("--days=".length) ?? "7";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startArg)) {
    throw new Error("Use --start=YYYY-MM-DD");
  }

  const parsedDays = Number(daysArg);

  if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 31) {
    throw new Error("Use --days as an integer from 1 to 31");
  }

  return { days: parsedDays, start: startArg };
}

function readEnvFile(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, "")];
      })
  );
}

async function fetchEvents(startDate, dayCount) {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const eventsById = new Map();

  for (let day = 0; day < dayCount; day += 1) {
    const date = new Date(startMs + day * DAY_MS).toISOString().slice(0, 10).replaceAll("-", "");
    const response = await withRetry(() => fetch(`${ESPN_BASE_URL}/scoreboard?dates=${date}&limit=100`));

    if (!response.ok) {
      throw new Error(`ESPN scoreboard request failed for ${date} with ${response.status}`);
    }

    const payload = await response.json();

    for (const event of payload.events ?? []) {
      if (event.id && event.date) {
        eventsById.set(String(event.id), event);
      }
    }
  }

  return [...eventsById.values()].sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
}

async function withRetry(operation, attempts = 4) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }

  throw lastError;
}

function hasRealTeams(event) {
  return isRealTeam(competitorBySide(event, "home")?.team) && isRealTeam(competitorBySide(event, "away")?.team);
}

function isRealTeam(team) {
  return Boolean(team?.id && team?.abbreviation && !/^\d/.test(team.abbreviation) && team.abbreviation !== "RD32");
}

function competitorBySide(event, side) {
  return event.competitions?.[0]?.competitors?.find((competitor) => competitor.homeAway === side) ?? null;
}

function ensureTeam(providerTeam, teamByCode, teamsToInsert) {
  if (!isRealTeam(providerTeam) || teamByCode.has(providerTeam.abbreviation)) {
    return;
  }

  const override = TEAM_OVERRIDES[providerTeam.abbreviation];
  const team = {
    id: uuidFromNumeric("20000000", providerTeam.id),
    name: override?.name ?? providerTeam.displayName,
    short_code: providerTeam.abbreviation,
    flag_code: override?.flagCode ?? FLAG_BY_CODE[providerTeam.abbreviation] ?? null
  };

  teamsToInsert.push(team);
  teamByCode.set(team.short_code, team);
}

function uuidFromNumeric(prefix, value) {
  return `${prefix}-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

function matchKey(kickoffAt, homeCode, awayCode) {
  return `${new Date(kickoffAt).toISOString()}|${homeCode}|${awayCode}`;
}

function normalizeStatus(status) {
  const text = `${status?.state ?? ""} ${status?.description ?? ""} ${status?.name ?? ""}`.toLowerCase();

  if (status?.completed || status?.state === "post" || text.includes("full time")) {
    return "final";
  }

  if (status?.state === "in") {
    return "live";
  }

  if (text.includes("postponed") || text.includes("canceled") || text.includes("cancelled")) {
    return "postponed";
  }

  return "scheduled";
}
