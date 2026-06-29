# Scoring Audit Queries

Use these queries in the Supabase SQL Editor to validate that a room leaderboard matches the raw match results and player predictions.

Replace this slug before running:

```sql
bon-jor-wc26-63e7
```

## 1. Find Rooms

```sql
select
  r.id,
  r.name,
  r.slug,
  r.created_at,
  count(rm.player_id) as player_count
from rooms r
left join room_members rm on rm.room_id = r.id
group by r.id, r.name, r.slug, r.created_at
order by r.created_at desc;
```

## 2. Confirm Room Players

```sql
select
  r.id as room_id,
  r.name as room_name,
  r.slug,
  p.id as player_id,
  p.display_name,
  rm.role,
  rm.joined_at
from rooms r
join room_members rm on rm.room_id = r.id
join players p on p.id = rm.player_id
where r.slug = 'bon-jor-wc26-63e7'
order by rm.joined_at;
```

## 3. Prediction-By-Prediction Audit

This recalculates expected points from raw match facts and predictions, then compares them with the stored score fields. Every `total_diff` should be `0`.

```sql
with room_players as (
  select
    r.id as room_id,
    r.name as room_name,
    r.slug,
    p.id as player_id,
    p.display_name
  from rooms r
  join room_members rm on rm.room_id = r.id
  join players p on p.id = rm.player_id
  where r.slug = 'bon-jor-wc26-63e7'
),
audit as (
  select
    rp.room_name,
    rp.slug,
    rp.display_name,
    m.kickoff_at at time zone 'Asia/Kolkata' as kickoff_ist,
    m.stage,
    ht.short_code as home,
    away_t.short_code as away,
    m.status,

    concat(m.home_score, '-', m.away_score) as actual_ft,
    concat(m.home_halftime_score, '-', m.away_halftime_score) as actual_ht,
    case
      when m.home_penalty_score is not null and m.away_penalty_score is not null
      then concat(m.home_penalty_score, '-', m.away_penalty_score)
      else null
    end as actual_pens,
    m.winner as actual_result,

    concat(pr.final_home_score, '-', pr.final_away_score) as predicted_ft,
    concat(pr.halftime_home_score, '-', pr.halftime_away_score) as predicted_ht,
    case
      when pr.penalty_home_score is not null and pr.penalty_away_score is not null
      then concat(pr.penalty_home_score, '-', pr.penalty_away_score)
      else null
    end as predicted_pens,
    pr.match_result as predicted_result,

    pr.score_final as stored_final,
    pr.score_result as stored_result,
    pr.score_halftime as stored_ht,
    pr.score_first_scorer as stored_first,
    pr.score_last_scorer as stored_last,
    coalesce(pr.score_penalty, 0) as stored_penalty,
    pr.score_total as stored_total,

    case
      when m.home_score is not null
       and m.away_score is not null
       and pr.final_home_score = m.home_score
       and pr.final_away_score = m.away_score
      then 10 else 0
    end as expected_final,

    case
      when m.home_score is not null
       and m.away_score is not null
       and pr.match_result = m.winner
      then 5 else 0
    end as expected_result,

    case
      when m.home_halftime_score is not null
       and m.away_halftime_score is not null
       and pr.halftime_home_score = m.home_halftime_score
       and pr.halftime_away_score = m.away_halftime_score
      then 6 else 0
    end as expected_ht,

    case
      when m.first_scoring_team_id is not null
       and pr.first_scoring_team_id = m.first_scoring_team_id
      then 4 else 0
    end as expected_first,

    case
      when m.last_scoring_team_id is not null
       and pr.last_scoring_team_id = m.last_scoring_team_id
      then 4 else 0
    end as expected_last,

    case
      when m.home_score = m.away_score
       and m.winner = 'draw'
       and m.home_penalty_score is not null
       and m.away_penalty_score is not null
       and pr.penalty_home_score is not null
       and pr.penalty_away_score is not null
       and pr.penalty_home_score = m.home_penalty_score
       and pr.penalty_away_score = m.away_penalty_score
      then 7

      when m.home_score = m.away_score
       and m.winner = 'draw'
       and m.home_penalty_score is not null
       and m.away_penalty_score is not null
       and pr.penalty_home_score is not null
       and pr.penalty_away_score is not null
       and (
         pr.penalty_home_score = m.home_penalty_score
         or pr.penalty_away_score = m.away_penalty_score
       )
      then 4

      when m.home_score = m.away_score
       and m.winner = 'draw'
       and m.home_penalty_score is not null
       and m.away_penalty_score is not null
       and pr.penalty_home_score is not null
       and pr.penalty_away_score is not null
       and pr.penalty_home_score <> pr.penalty_away_score
       and (
         (pr.penalty_home_score > pr.penalty_away_score and m.home_penalty_score > m.away_penalty_score)
         or
         (pr.penalty_home_score < pr.penalty_away_score and m.home_penalty_score < m.away_penalty_score)
       )
      then 3

      else 0
    end as expected_penalty
  from room_players rp
  join predictions pr on pr.player_id = rp.player_id
  join matches m on m.id = pr.match_id
  join teams ht on ht.id = m.home_team_id
  join teams away_t on away_t.id = m.away_team_id
)
select
  *,
  (
    expected_final
    + expected_result
    + expected_ht
    + expected_first
    + expected_last
    + expected_penalty
  ) as expected_total,
  stored_total - (
    expected_final
    + expected_result
    + expected_ht
    + expected_first
    + expected_last
    + expected_penalty
  ) as total_diff
from audit
order by kickoff_ist, home, away, display_name;
```

## 4. Leaderboard Summary Audit

This summarizes the same scoring check by player. Every `board_diff` should be `0`.

```sql
with room_players as (
  select
    r.id as room_id,
    r.name as room_name,
    r.slug,
    p.id as player_id,
    p.display_name
  from rooms r
  join room_members rm on rm.room_id = r.id
  join players p on p.id = rm.player_id
  where r.slug = 'bon-jor-wc26-63e7'
),
audit as (
  select
    rp.display_name,
    pr.score_total as stored_total,

    case
      when m.home_score is not null
       and m.away_score is not null
       and pr.final_home_score = m.home_score
       and pr.final_away_score = m.away_score
      then 10 else 0
    end as expected_final,

    case
      when m.home_score is not null
       and m.away_score is not null
       and pr.match_result = m.winner
      then 5 else 0
    end as expected_result,

    case
      when m.home_halftime_score is not null
       and m.away_halftime_score is not null
       and pr.halftime_home_score = m.home_halftime_score
       and pr.halftime_away_score = m.away_halftime_score
      then 6 else 0
    end as expected_ht,

    case
      when m.first_scoring_team_id is not null
       and pr.first_scoring_team_id = m.first_scoring_team_id
      then 4 else 0
    end as expected_first,

    case
      when m.last_scoring_team_id is not null
       and pr.last_scoring_team_id = m.last_scoring_team_id
      then 4 else 0
    end as expected_last,

    case
      when m.home_score = m.away_score
       and m.winner = 'draw'
       and m.home_penalty_score is not null
       and m.away_penalty_score is not null
       and pr.penalty_home_score = m.home_penalty_score
       and pr.penalty_away_score = m.away_penalty_score
      then 7

      when m.home_score = m.away_score
       and m.winner = 'draw'
       and m.home_penalty_score is not null
       and m.away_penalty_score is not null
       and pr.penalty_home_score is not null
       and pr.penalty_away_score is not null
       and (
         pr.penalty_home_score = m.home_penalty_score
         or pr.penalty_away_score = m.away_penalty_score
       )
      then 4

      when m.home_score = m.away_score
       and m.winner = 'draw'
       and m.home_penalty_score is not null
       and m.away_penalty_score is not null
       and pr.penalty_home_score is not null
       and pr.penalty_away_score is not null
       and pr.penalty_home_score <> pr.penalty_away_score
       and (
         (pr.penalty_home_score > pr.penalty_away_score and m.home_penalty_score > m.away_penalty_score)
         or
         (pr.penalty_home_score < pr.penalty_away_score and m.home_penalty_score < m.away_penalty_score)
       )
      then 3

      else 0
    end as expected_penalty
  from room_players rp
  join predictions pr on pr.player_id = rp.player_id
  join matches m on m.id = pr.match_id
),
detailed as (
  select
    display_name,
    stored_total,
    (
      expected_final
      + expected_result
      + expected_ht
      + expected_first
      + expected_last
      + expected_penalty
    ) as expected_total
  from audit
)
select
  display_name,
  count(*) as predictions,
  sum(stored_total) as stored_board_points,
  sum(expected_total) as expected_board_points,
  sum(stored_total) - sum(expected_total) as board_diff
from detailed
group by display_name
order by expected_board_points desc, display_name;
```

## How To Read Results

- `total_diff = 0`: that prediction row is scored correctly.
- `total_diff != 0`: that row needs investigation or a score refresh.
- `board_diff = 0`: the leaderboard total matches the recalculated total.
- `board_diff != 0`: the visible leaderboard is out of sync for that player.

These queries prove scoring math against the current data in Supabase. If official match facts in `matches` are wrong, the scoring can still be mathematically consistent against wrong source data.
