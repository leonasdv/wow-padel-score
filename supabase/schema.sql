-- WOWPadel Score — shareable rounds & standings
--
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query). Safe to re-run any
-- time this file changes — every statement is idempotent (add-column-if-not-exists, drop-then-
-- recreate for functions whose signature changed, create-or-replace everywhere else) so re-running
-- the whole file against an *existing* project brings it up to date without touching existing rows.
--
-- Design: the tables themselves grant NO direct access to anon/authenticated roles.
-- All reads/writes go through the SECURITY DEFINER functions below, so the public anon
-- key can never be used to dump every published event — only the exact share_id a caller
-- already knows, and only writes authorized by the matching secret token.
--
-- Two distinct secret tokens, deliberately kept separate:
--   edit_token   — private, held only by the organizer's app. Full power: overwrite the whole
--                  event payload, unpublish, flip who's allowed to enter scores, drain the score
--                  queue below. Never shown in any UI.
--   editor_token — meant to be handed out on a separate "Score entry" link. Can only submit
--                  individual match scores via submit_shared_score, and only while the event is
--                  toggled to web input — nothing else. Keeping it separate from edit_token limits
--                  the blast radius if a score-entry link leaks.

create extension if not exists pgcrypto;

create table if not exists public.shared_events (
  id uuid primary key default gen_random_uuid(),
  share_id text unique not null,
  edit_token text unique not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added for web-editable score entry — safe on an existing table (nullable/defaulted).
alter table public.shared_events add column if not exists editor_token text unique;
alter table public.shared_events add column if not exists input_source text not null default 'app';
alter table public.shared_events drop constraint if exists shared_events_input_source_check;
alter table public.shared_events add constraint shared_events_input_source_check
  check (input_source in ('app', 'web'));

alter table public.shared_events enable row level security;
-- Intentionally no policies: with RLS on and zero policies, anon/authenticated
-- have zero direct SELECT/INSERT/UPDATE/DELETE access via PostgREST or the
-- client library. Only the SECURITY DEFINER functions below (owned by the
-- table owner) can touch the table, bypassing RLS internally.

revoke all on public.shared_events from anon, authenticated;

-- Append-only queue of scores submitted from the web editor. The organizer's app drains this
-- (via get_pending_score_submissions / ack_score_submissions) and applies each entry through its
-- own applyScore logic, which stays the source of truth. get_shared_event additionally mirrors the
-- score/standings/auto-advance rules at read time (see below) purely so viewers update while the
-- app is closed — nothing from that overlay is ever written back.
create table if not exists public.shared_event_score_submissions (
  id bigint generated always as identity primary key,
  share_id text not null references public.shared_events(share_id) on delete cascade,
  round_index int not null,
  court_id text not null,
  team text not null check (team in ('A', 'B')),
  value int not null check (value >= 0),
  submitted_at timestamptz not null default now()
);

alter table public.shared_event_score_submissions enable row level security;
revoke all on public.shared_event_score_submissions from anon, authenticated;

-- create_shared_event's signature grew an editor_token param — drop the old 3-arg overload first
-- so a re-run doesn't leave both versions callable side by side.
drop function if exists public.create_shared_event(text, text, jsonb);

create or replace function public.create_shared_event(
  p_share_id text,
  p_edit_token text,
  p_editor_token text,
  p_payload jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into shared_events (share_id, edit_token, editor_token, payload)
  values (p_share_id, p_edit_token, p_editor_token, p_payload);
$$;

create or replace function public.update_shared_event(
  p_share_id text,
  p_edit_token text,
  p_payload jsonb
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update shared_events
  set payload = p_payload, updated_at = now()
  where share_id = p_share_id and edit_token = p_edit_token
  returning true;
$$;

create or replace function public.unpublish_shared_event(
  p_share_id text,
  p_edit_token text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  delete from shared_events
  where share_id = p_share_id and edit_token = p_edit_token
  returning true;
$$;

-- get_shared_event's return row grew input_source, then pending_version — return-type changes need a drop too.
drop function if exists public.get_shared_event(text);

-- Standings math, mirroring computeStandings + sortStandings(…, 'points', rounds) in
-- src/lib/tournament.ts (non-knockout formats). Used only by get_shared_event's read-time overlay
-- below, so a web viewer sees up-to-date standings even while the organizer's phone is asleep.
-- If you change the ranking rules in tournament.ts, change them here too.

-- Head-to-head net result, same sign convention as headToHeadCompare: positive means `other`
-- beat `own` more often in matches where they were on opposing teams.
create or replace function public.wow_h2h_compare(p_rounds jsonb, p_own text, p_other text)
returns int
language plpgsql
immutable
set search_path = public
as $$
declare
  v_round jsonb;
  v_m jsonb;
  v_own_wins int := 0;
  v_other_wins int := 0;
  v_own_a boolean;
  v_own_b boolean;
  v_other_a boolean;
  v_other_b boolean;
  v_own_score int;
  v_other_score int;
begin
  for v_round in select * from jsonb_array_elements(coalesce(p_rounds, '[]'::jsonb)) loop
    for v_m in select * from jsonb_array_elements(coalesce(v_round->'matches', '[]'::jsonb)) loop
      if jsonb_typeof(v_m->'scoreA') <> 'number' or jsonb_typeof(v_m->'scoreB') <> 'number' then
        continue;
      end if;
      v_own_a := (v_m->'teamA') ? p_own;
      v_own_b := (v_m->'teamB') ? p_own;
      v_other_a := (v_m->'teamA') ? p_other;
      v_other_b := (v_m->'teamB') ? p_other;
      if not (v_own_a or v_own_b) or not (v_other_a or v_other_b) then continue; end if;
      if (v_own_a and v_other_a) or (v_own_b and v_other_b) then continue; end if; -- teammates
      v_own_score := case when v_own_a then (v_m->>'scoreA')::int else (v_m->>'scoreB')::int end;
      v_other_score := case when v_other_a then (v_m->>'scoreA')::int else (v_m->>'scoreB')::int end;
      if v_own_score > v_other_score then v_own_wins := v_own_wins + 1;
      elsif v_other_score > v_own_score then v_other_wins := v_other_wins + 1;
      end if;
    end loop;
  end loop;
  return v_other_wins - v_own_wins;
end;
$$;

-- Builds the standings array (sorted) for a payload's players + rounds.
create or replace function public.wow_compute_standings(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_rounds jsonb := coalesce(p_payload->'rounds', '[]'::jsonb);
  v_players jsonb := coalesce(p_payload->'players', '[]'::jsonb);
  v_ids text[] := '{}';
  v_played int[] := '{}';
  v_wins int[] := '{}';
  v_draws int[] := '{}';
  v_points int[] := '{}';
  v_order int[] := '{}';
  n int;
  i int;
  j int;
  v_key int;
  v_round jsonb;
  v_m jsonb;
  v_a int;
  v_b int;
  v_pid text;
  v_idx int;
  v_cmp int;
  v_lp_a numeric;
  v_lp_b numeric;
  v_result jsonb := '[]'::jsonb;
begin
  n := jsonb_array_length(v_players);
  for i in 1..n loop
    v_ids := v_ids || ((v_players->(i - 1))->>'id');
    v_played := v_played || 0;
    v_wins := v_wins || 0;
    v_draws := v_draws || 0;
    v_points := v_points || 0;
    v_order := v_order || i;
  end loop;

  for v_round in select * from jsonb_array_elements(v_rounds) loop
    for v_m in select * from jsonb_array_elements(coalesce(v_round->'matches', '[]'::jsonb)) loop
      if jsonb_typeof(v_m->'scoreA') <> 'number' or jsonb_typeof(v_m->'scoreB') <> 'number' then
        continue;
      end if;
      v_a := (v_m->>'scoreA')::int;
      v_b := (v_m->>'scoreB')::int;
      for v_pid in select * from jsonb_array_elements_text(v_m->'teamA') loop
        v_idx := array_position(v_ids, v_pid);
        if v_idx is null then continue; end if;
        v_played[v_idx] := v_played[v_idx] + 1;
        v_points[v_idx] := v_points[v_idx] + v_a;
        if v_a > v_b then v_wins[v_idx] := v_wins[v_idx] + 1; end if;
        if v_a = v_b then v_draws[v_idx] := v_draws[v_idx] + 1; end if;
      end loop;
      for v_pid in select * from jsonb_array_elements_text(v_m->'teamB') loop
        v_idx := array_position(v_ids, v_pid);
        if v_idx is null then continue; end if;
        v_played[v_idx] := v_played[v_idx] + 1;
        v_points[v_idx] := v_points[v_idx] + v_b;
        if v_b > v_a then v_wins[v_idx] := v_wins[v_idx] + 1; end if;
        if v_a = v_b then v_draws[v_idx] := v_draws[v_idx] + 1; end if;
      end loop;
    end loop;
  end loop;

  -- Stable insertion sort (players are few) so the pairwise head-to-head tiebreak can sit in the
  -- comparator chain exactly like sortStandings: points → league pts/match → wins → draws →
  -- fewer losses → head-to-head. Ties keep roster order, matching the JS stable sort.
  for i in 2..n loop
    v_key := v_order[i];
    j := i - 1;
    while j >= 1 loop
      -- compare(a = v_order[j], b = v_key): > 0 means b should come before a
      v_lp_a := case when v_played[v_order[j]] = 0 then 0
                     else (v_wins[v_order[j]] * 3 + v_draws[v_order[j]])::numeric / v_played[v_order[j]] end;
      v_lp_b := case when v_played[v_key] = 0 then 0
                     else (v_wins[v_key] * 3 + v_draws[v_key])::numeric / v_played[v_key] end;
      v_cmp := sign(v_points[v_key] - v_points[v_order[j]])::int;
      if v_cmp = 0 then v_cmp := sign(v_lp_b - v_lp_a)::int; end if;
      if v_cmp = 0 then v_cmp := sign(v_wins[v_key] - v_wins[v_order[j]])::int; end if;
      if v_cmp = 0 then v_cmp := sign(v_draws[v_key] - v_draws[v_order[j]])::int; end if;
      if v_cmp = 0 then
        v_cmp := sign(
          (v_played[v_order[j]] - v_wins[v_order[j]] - v_draws[v_order[j]])
          - (v_played[v_key] - v_wins[v_key] - v_draws[v_key])
        )::int;
      end if;
      if v_cmp = 0 then
        v_cmp := sign(wow_h2h_compare(v_rounds, v_ids[v_order[j]], v_ids[v_key]))::int;
      end if;
      exit when v_cmp <= 0;
      v_order[j + 1] := v_order[j];
      j := j - 1;
    end loop;
    v_order[j + 1] := v_key;
  end loop;

  for i in 1..n loop
    v_idx := v_order[i];
    v_result := v_result || jsonb_build_object(
      'player', v_players->(v_idx - 1),
      'played', v_played[v_idx],
      'wins', v_wins[v_idx],
      'draws', v_draws[v_idx],
      'points', v_points[v_idx]
    );
  end loop;
  return v_result;
end;
$$;

revoke execute on function public.wow_h2h_compare(jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.wow_compute_standings(jsonb) from public, anon, authenticated;

-- Read path: overlays any scores still sitting in the web-submission queue onto the stored
-- payload before returning it, purely for this read — nothing is written back here. Without this,
-- a viewer only sees a web-submitted score once the organizer's app has actually run, pulled the
-- queue, and pushed a new payload. The overlay mirrors the app's applyScore: it patches the score
-- (including the "other side = pot − score" rule in total mode), recomputes standings, and for the
-- fixed-schedule formats (Americano / Mix Americano / Team Americano) marks a fully-scored current
-- round completed and advances to the next one (or ends the event). The ranking formats (Mexicano /
-- Mixicano / Team Mexicano) build their next round from live standings with randomness, so that
-- one step still waits for the app — viewers see the new scores and standings immediately, and the
-- next round appears once the app next runs. The queue itself is untouched; the app still drains it.
create or replace function public.get_shared_event(p_share_id text)
returns table(payload jsonb, updated_at timestamptz, input_source text, pending_version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_updated_at timestamptz;
  v_input_source text;
  v_pending_version bigint;
  v_sub record;
  v_round_idx int;
  v_match_idx int;
  v_format text;
  v_pot int;
  v_scoring_mode text;
  v_status text;
  v_current int;
  v_total int;
  v_fixed boolean;
  v_value int;
  v_other int;
  v_all_scored boolean;
begin
  select se.payload, se.updated_at, se.input_source
  into v_payload, v_updated_at, v_input_source
  from shared_events se
  where se.share_id = p_share_id;

  if v_payload is null then
    return;
  end if;

  select coalesce(max(s.id), 0) into v_pending_version
  from shared_event_score_submissions s
  where s.share_id = p_share_id;

  if v_pending_version = 0 then
    return query select v_payload, v_updated_at, v_input_source, v_pending_version;
    return;
  end if;

  v_format := v_payload->>'format';
  v_scoring_mode := v_payload->>'scoringMode';
  v_pot := nullif(v_payload->>'pot', '')::int;
  v_status := v_payload->>'status';
  v_current := (v_payload->>'currentRoundIndex')::int;
  v_total := (v_payload->>'totalRoundsEstimate')::int;
  v_fixed := v_format in ('americano', 'mix_americano', 'team_americano');

  for v_sub in
    select * from shared_event_score_submissions
    where share_id = p_share_id
    order by id asc
  loop
    v_round_idx := null;
    select ord.idx - 1 into v_round_idx
    from jsonb_array_elements(v_payload->'rounds') with ordinality as ord(round, idx)
    where (ord.round->>'index')::int = v_sub.round_index
    limit 1;

    if v_round_idx is not null then
      v_match_idx := null;
      select ord.idx - 1 into v_match_idx
      from jsonb_array_elements(v_payload#>array['rounds', v_round_idx::text, 'matches']) with ordinality as ord(m, idx)
      where ord.m->>'courtId' = v_sub.court_id
      limit 1;

      if v_match_idx is not null then
        -- Same clamping / total-mode complement as setScore in tournament.ts.
        if v_scoring_mode = 'total' and v_pot is not null then
          v_value := greatest(0, least(v_pot, v_sub.value));
          v_other := v_pot - v_value;
          v_payload := jsonb_set(
            v_payload,
            array['rounds', v_round_idx::text, 'matches', v_match_idx::text, case when v_sub.team = 'A' then 'scoreA' else 'scoreB' end],
            to_jsonb(v_value)
          );
          v_payload := jsonb_set(
            v_payload,
            array['rounds', v_round_idx::text, 'matches', v_match_idx::text, case when v_sub.team = 'A' then 'scoreB' else 'scoreA' end],
            to_jsonb(v_other)
          );
        else
          v_value := greatest(0, least(99, v_sub.value));
          v_payload := jsonb_set(
            v_payload,
            array['rounds', v_round_idx::text, 'matches', v_match_idx::text, case when v_sub.team = 'A' then 'scoreA' else 'scoreB' end],
            to_jsonb(v_value)
          );
        end if;

        -- applyScore's auto-advance, for formats whose next round doesn't depend on standings.
        if v_fixed and v_status = 'live' and v_sub.round_index = v_current then
          select coalesce(bool_and(
            jsonb_typeof(m->'scoreA') = 'number' and jsonb_typeof(m->'scoreB') = 'number'
          ), true)
          into v_all_scored
          from jsonb_array_elements(v_payload#>array['rounds', v_round_idx::text, 'matches']) as m;

          if v_all_scored then
            v_payload := jsonb_set(v_payload, array['rounds', v_round_idx::text, 'completed'], 'true'::jsonb);
            if v_current + 1 > v_total then
              v_status := 'done';
            else
              v_current := v_current + 1;
            end if;
          end if;
        end if;
      end if;
    end if;
  end loop;

  if v_format <> 'knockout' then
    v_payload := jsonb_set(v_payload, '{standings}', wow_compute_standings(v_payload));
  end if;
  if v_status is not null then v_payload := jsonb_set(v_payload, '{status}', to_jsonb(v_status)); end if;
  if v_current is not null then v_payload := jsonb_set(v_payload, '{currentRoundIndex}', to_jsonb(v_current)); end if;

  return query select v_payload, v_updated_at, v_input_source, v_pending_version;
end;
$$;

-- Organizer-only (edit_token gated): flips which side is allowed to submit scores.
create or replace function public.set_shared_input_source(
  p_share_id text,
  p_edit_token text,
  p_source text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update shared_events
  set input_source = p_source, updated_at = now()
  where share_id = p_share_id and edit_token = p_edit_token and p_source in ('app', 'web')
  returning true;
$$;

-- Web-editor-only (editor_token gated): queues one match score. Rejected (returns false) unless
-- the event is currently toggled to web input — a backstop behind the web UI's own mode check.
create or replace function public.submit_shared_score(
  p_share_id text,
  p_editor_token text,
  p_round_index int,
  p_court_id text,
  p_team text,
  p_value int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_authorized boolean;
begin
  select true into v_authorized
  from shared_events
  where share_id = p_share_id
    and editor_token = p_editor_token
    and input_source = 'web';

  if v_authorized is null then
    return false;
  end if;

  insert into shared_event_score_submissions (share_id, round_index, court_id, team, value)
  values (p_share_id, p_round_index, p_court_id, p_team, p_value);

  return true;
end;
$$;

-- Organizer-only (edit_token gated): drains the queue in submission order.
create or replace function public.get_pending_score_submissions(
  p_share_id text,
  p_edit_token text
)
returns setof shared_event_score_submissions
language sql
security definer
set search_path = public
as $$
  select s.*
  from shared_event_score_submissions s
  where s.share_id = p_share_id
    and exists (
      select 1 from shared_events e
      where e.share_id = p_share_id and e.edit_token = p_edit_token
    )
  order by s.id asc;
$$;

-- Organizer-only (edit_token gated): removes queue rows once the app has applied them locally.
create or replace function public.ack_score_submissions(
  p_share_id text,
  p_edit_token text,
  p_ids bigint[]
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from shared_event_score_submissions
  where share_id = p_share_id
    and id = any(p_ids)
    and exists (
      select 1 from shared_events e
      where e.share_id = p_share_id and e.edit_token = p_edit_token
    );
$$;

grant execute on function public.create_shared_event(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.update_shared_event(text, text, jsonb) to anon, authenticated;
grant execute on function public.unpublish_shared_event(text, text) to anon, authenticated;
grant execute on function public.get_shared_event(text) to anon, authenticated;
grant execute on function public.set_shared_input_source(text, text, text) to anon, authenticated;
grant execute on function public.submit_shared_score(text, text, int, text, text, int) to anon, authenticated;
grant execute on function public.get_pending_score_submissions(text, text) to anon, authenticated;
grant execute on function public.ack_score_submissions(text, text, bigint[]) to anon, authenticated;
