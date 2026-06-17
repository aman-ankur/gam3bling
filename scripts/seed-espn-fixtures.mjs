#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const TOURNAMENT_ID = "11111111-1111-4111-8111-111111111111";
const DAY_MS = 24 * 60 * 60 * 1000;

const TEAM_GROUPS = {
  ARG: "J",
  ALG: "J",
  AUS: "D",
  AUT: "J",
  BEL: "G",
  BIH: "B",
  BRA: "C",
  CAN: "B",
  CIV: "E",
  COD: "K",
  COL: "K",
  CPV: "H",
  CUW: "E",
  CZE: "A",
  ECU: "E",
  EGY: "G",
  ENG: "L",
  ESP: "H",
  FRA: "I",
  GER: "E",
  GHA: "L",
  HAI: "C",
  IRN: "G",
  IRQ: "I",
  JOR: "J",
  JPN: "F",
  KOR: "A",
  KSA: "H",
  MAR: "C",
  MEX: "A",
  NED: "F",
  NOR: "I",
  NZL: "G",
  PAN: "L",
  PAR: "D",
  POR: "K",
  QAT: "B",
  RSA: "A",
  SCO: "C",
  SEN: "I",
  SUI: "B",
  SWE: "F",
  TUN: "F",
  TUR: "D",
  URU: "H",
  USA: "D",
  UZB: "K"
};

const TEAM_OVERRIDES = {
  BIH: { name: "Bosnia-Herzegovina", flagCode: "BA" },
  CIV: { name: "Ivory Coast", flagCode: "CI" },
  COD: { name: "DR Congo", flagCode: "CD" },
  CPV: { name: "Cape Verde", flagCode: "CV" },
  CUW: { name: "Curacao", flagCode: "CW" },
  CZE: { name: "Czechia", flagCode: "CZ" },
  ENG: { name: "England", flagCode: "GB-ENG" },
  KOR: { name: "South Korea", flagCode: "KR" },
  MAR: { name: "Morocco", flagCode: "MA" },
  NZL: { name: "New Zealand", flagCode: "NZ" },
  PAR: { name: "Paraguay", flagCode: "PY" },
  RSA: { name: "South Africa", flagCode: "ZA" },
  SCO: { name: "Scotland", flagCode: "GB-SCT" },
  SUI: { name: "Switzerland", flagCode: "CH" },
  TUR: { name: "Turkiye", flagCode: "TR" },
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
  HAI: "HT",
  IRN: "IR",
  IRQ: "IQ",
  JOR: "JO",
  JPN: "JP",
  KSA: "SA",
  MEX: "MX",
  NED: "NL",
  NOR: "NO",
  PAN: "PA",
  POR: "PT",
  QAT: "QA",
  SEN: "SN",
  SWE: "SE",
  TUN: "TN",
  URU: "UY",
  UZB: "UZ"
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
const realEvents = events.filter(hasRealTeams);
const { data: existingTeams, error: teamError } = await supabase
  .from("teams")
  .select("id, name, short_code, flag_code");

if (teamError) {
  throw teamError;
}

const { data: existingMatches, error: matchError } = await supabase
  .from("matches")
  .select("id, kickoff_at, api_match_id, home:teams!matches_home_team_id_fkey(short_code), away:teams!matches_away_team_id_fkey(short_code)");

if (matchError) {
  throw matchError;
}

const teamByCode = new Map((existingTeams ?? []).map((team) => [team.short_code, team]));
const matchByEventId = new Map((existingMatches ?? []).map((match) => [match.api_match_id, match]));
const matchByKickoffAndTeams = new Map((existingMatches ?? []).map((match) => [
  matchKey(match.kickoff_at, match.home?.short_code, match.away?.short_code),
  match
]));
const teamsToUpsertByCode = new Map();
const matchesToUpsert = [];

for (const event of realEvents) {
  const home = competitorBySide(event, "home")?.team;
  const away = competitorBySide(event, "away")?.team;

  ensureTeam(home, teamByCode, teamsToUpsertByCode);
  ensureTeam(away, teamByCode, teamsToUpsertByCode);
}

if (teamsToUpsertByCode.size > 0) {
  const { error } = await supabase
    .from("teams")
    .upsert([...teamsToUpsertByCode.values()], { onConflict: "id" });

  if (error) {
    throw error;
  }

  for (const team of teamsToUpsertByCode.values()) {
    teamByCode.set(team.short_code, team);
  }
}

for (const event of realEvents) {
  const home = competitorBySide(event, "home")?.team;
  const away = competitorBySide(event, "away")?.team;
  const homeTeam = teamByCode.get(home.abbreviation);
  const awayTeam = teamByCode.get(away.abbreviation);
  const existingMatch = matchByEventId.get(String(event.id))
    ?? matchByKickoffAndTeams.get(matchKey(event.date, home.abbreviation, away.abbreviation));
  const groupName = TEAM_GROUPS[home.abbreviation] ?? TEAM_GROUPS[away.abbreviation] ?? null;

  if (!homeTeam || !awayTeam || !groupName) {
    continue;
  }

  matchesToUpsert.push({
    id: existingMatch?.id ?? uuidFromNumeric("30000000", event.id),
    tournament_id: TOURNAMENT_ID,
    home_team_id: homeTeam.id,
    away_team_id: awayTeam.id,
    kickoff_at: event.date,
    stage: `Group ${groupName}`,
    group_name: groupName,
    status: normalizeStatus(event.status?.type),
    api_provider: "espn",
    api_match_id: String(event.id),
    updated_at: new Date().toISOString()
  });
}

if (matchesToUpsert.length > 0) {
  const { error } = await supabase
    .from("matches")
    .upsert(matchesToUpsert, { onConflict: "id" });

  if (error) {
    throw error;
  }
}

console.log(JSON.stringify({
  start,
  days,
  fetchedEvents: events.length,
  seededEvents: matchesToUpsert.length,
  skippedPlaceholders: events.length - realEvents.length,
  teamsUpserted: teamsToUpsertByCode.size,
  matchesUpserted: matchesToUpsert.length,
  firstKickoff: matchesToUpsert[0]?.kickoff_at ?? null,
  lastKickoff: matchesToUpsert.at(-1)?.kickoff_at ?? null
}, null, 2));

function parseArgs(args) {
  const startArg = args.find((arg) => arg.startsWith("--start="))?.slice("--start=".length)
    ?? new Date().toISOString().slice(0, 10);
  const daysArg = args.find((arg) => arg.startsWith("--days="))?.slice("--days=".length) ?? "10";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startArg)) {
    throw new Error("Use --start=YYYY-MM-DD");
  }

  const parsedDays = Number(daysArg);

  if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 31) {
    throw new Error("Use --days as an integer from 1 to 31");
  }

  return {
    days: parsedDays,
    start: startArg
  };
}

function readEnvFile(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, "");

        return [key, value];
      })
  );
}

async function fetchEvents(startDate, dayCount) {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const eventsById = new Map();

  for (let day = 0; day < dayCount; day += 1) {
    const date = new Date(startMs + day * DAY_MS).toISOString().slice(0, 10).replaceAll("-", "");
    const response = await fetch(`${ESPN_BASE_URL}/scoreboard?dates=${date}&limit=100`);

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

function hasRealTeams(event) {
  const home = competitorBySide(event, "home")?.team;
  const away = competitorBySide(event, "away")?.team;

  return isRealTeam(home) && isRealTeam(away);
}

function isRealTeam(team) {
  return Boolean(team?.id && team?.abbreviation && !/^\d/.test(team.abbreviation));
}

function competitorBySide(event, side) {
  return event.competitions?.[0]?.competitors?.find((competitor) => competitor.homeAway === side) ?? null;
}

function ensureTeam(providerTeam, teamByCode, teamsToUpsertByCode) {
  if (!isRealTeam(providerTeam) || teamByCode.has(providerTeam.abbreviation) || teamsToUpsertByCode.has(providerTeam.abbreviation)) {
    return;
  }

  const override = TEAM_OVERRIDES[providerTeam.abbreviation];

  teamsToUpsertByCode.set(providerTeam.abbreviation, {
    id: uuidFromNumeric("20000000", providerTeam.id),
    name: override?.name ?? providerTeam.displayName,
    short_code: providerTeam.abbreviation,
    flag_code: override?.flagCode ?? FLAG_BY_CODE[providerTeam.abbreviation] ?? null
  });
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
