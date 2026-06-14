create table match_details (
  match_id uuid primary key references matches(id) on delete cascade,
  provider text not null,
  status text not null default 'missing',
  lineups_status text not null default 'missing',
  stats_status text not null default 'missing',
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_details_status_check check (status in ('missing', 'available', 'unavailable', 'failed')),
  constraint match_details_lineups_status_check check (lineups_status in ('missing', 'available', 'unavailable', 'failed')),
  constraint match_details_stats_status_check check (stats_status in ('missing', 'available', 'unavailable', 'failed'))
);

create index match_details_provider_status_idx on match_details (provider, status);
create index match_details_last_fetched_idx on match_details (last_fetched_at);

create table match_lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id),
  provider_team_id text,
  formation text,
  coach_name text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_lineups_match_team_unique unique (match_id, team_id)
);

create index match_lineups_match_idx on match_lineups (match_id);

create table match_lineup_players (
  id uuid primary key default gen_random_uuid(),
  match_lineup_id uuid not null references match_lineups(id) on delete cascade,
  provider_player_id text,
  player_name text not null,
  shirt_number integer,
  position text,
  grid text,
  role text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint match_lineup_players_role_check check (role in ('starter', 'substitute')),
  constraint match_lineup_players_shirt_number_check check (shirt_number is null or shirt_number >= 0)
);

create index match_lineup_players_lineup_role_idx on match_lineup_players (match_lineup_id, role, sort_order);

create table match_team_statistics (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id),
  stat_name text not null,
  stat_value text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_team_statistics_match_team_stat_unique unique (match_id, team_id, stat_name)
);

create index match_team_statistics_match_idx on match_team_statistics (match_id, sort_order);
