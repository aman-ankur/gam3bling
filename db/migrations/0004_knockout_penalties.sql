alter table matches
  add column if not exists home_penalty_score integer,
  add column if not exists away_penalty_score integer;

alter table predictions
  add column if not exists penalty_home_score integer,
  add column if not exists penalty_away_score integer,
  add column if not exists score_penalty integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_penalty_score_values_check'
  ) then
    alter table matches
      add constraint matches_penalty_score_values_check check (
        (home_penalty_score is null or home_penalty_score >= 0)
        and (away_penalty_score is null or away_penalty_score >= 0)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'predictions_penalty_score_values_check'
  ) then
    alter table predictions
      add constraint predictions_penalty_score_values_check check (
        (penalty_home_score is null or penalty_home_score >= 0)
        and (penalty_away_score is null or penalty_away_score >= 0)
        and score_penalty >= 0
      );
  end if;
end $$;
