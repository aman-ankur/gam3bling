create extension if not exists pgcrypto;

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null,
  season text not null,
  status text not null,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tournaments_status_check check (status in ('planned', 'active', 'completed'))
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null,
  flag_code text,
  crest_url text,
  created_at timestamptz not null default now(),
  constraint teams_short_code_unique unique (short_code),
  constraint teams_short_code_format check (short_code = upper(short_code) and length(short_code) between 2 and 5)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  kickoff_at timestamptz not null,
  stage text not null,
  group_name text,
  status text not null,
  home_score integer,
  away_score integer,
  home_halftime_score integer,
  away_halftime_score integer,
  winner text,
  first_scoring_team_id uuid references teams(id),
  last_scoring_team_id uuid references teams(id),
  api_provider text,
  api_match_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_distinct_teams check (home_team_id <> away_team_id),
  constraint matches_status_check check (status in ('scheduled', 'live', 'halftime', 'final', 'postponed')),
  constraint matches_winner_check check (winner is null or winner in ('home', 'away', 'draw')),
  constraint matches_score_values_check check (
    (home_score is null or home_score >= 0)
    and (away_score is null or away_score >= 0)
    and (home_halftime_score is null or home_halftime_score >= 0)
    and (away_halftime_score is null or away_halftime_score >= 0)
  )
);

create index matches_tournament_kickoff_idx on matches (tournament_id, kickoff_at);
create index matches_status_kickoff_idx on matches (status, kickoff_at);
create index matches_api_provider_match_idx on matches (api_provider, api_match_id);

create table players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  pin_hash text not null,
  session_token_hash text,
  avatar_color text not null,
  avatar_badge text not null,
  avatar_initials text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint players_avatar_initials_not_blank check (length(btrim(avatar_initials)) > 0)
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  invite_code_hash text not null,
  creator_player_id uuid references players(id),
  created_at timestamptz not null default now(),
  constraint rooms_name_not_blank check (length(btrim(name)) > 0),
  constraint rooms_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9-]{3,64}$')
);

create table room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id),
  constraint room_members_role_check check (role in ('admin', 'member'))
);

create index room_members_player_idx on room_members (player_id);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  final_home_score integer not null,
  final_away_score integer not null,
  match_result text not null,
  halftime_home_score integer not null,
  halftime_away_score integer not null,
  first_scoring_team_id uuid references teams(id),
  last_scoring_team_id uuid references teams(id),
  locked_at timestamptz,
  submitted_at timestamptz not null default now(),
  score_final integer not null default 0,
  score_result integer not null default 0,
  score_halftime integer not null default 0,
  score_first_scorer integer not null default 0,
  score_last_scorer integer not null default 0,
  score_total integer not null default 0,
  scored_at timestamptz,
  constraint predictions_match_player_unique unique (match_id, player_id),
  constraint predictions_match_result_check check (match_result in ('home', 'away', 'draw')),
  constraint predictions_score_values_check check (
    final_home_score >= 0
    and final_away_score >= 0
    and halftime_home_score >= 0
    and halftime_away_score >= 0
    and score_final >= 0
    and score_result >= 0
    and score_halftime >= 0
    and score_first_scorer >= 0
    and score_last_scorer >= 0
    and score_total >= 0
  )
);

create index predictions_player_idx on predictions (player_id);
create index predictions_match_idx on predictions (match_id);

create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  sync_type text not null,
  status text not null,
  message text,
  created_at timestamptz not null default now(),
  constraint sync_logs_status_check check (status in ('started', 'success', 'failed'))
);

create index sync_logs_provider_created_idx on sync_logs (provider, created_at desc);
