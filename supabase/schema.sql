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
-- own setScore/advanceRound logic, so scoring and auto-advance rules only ever live in one place
-- (the app), not duplicated here in SQL.
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

-- Read path: overlays any scores still sitting in the web-submission queue onto the stored
-- payload before returning it, purely for this read — nothing is written back here. Without this,
-- a viewer only sees a web-submitted score once the organizer's app has actually run, pulled the
-- queue, and pushed a new payload; this lets every viewer (web included) see the raw number the
-- moment it's submitted, while standings and round-advancement still wait for the app's real pass
-- (this only patches the two score fields, it doesn't re-run any scoring/standings logic).
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
  v_field text;
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
        v_field := case when v_sub.team = 'A' then 'scoreA' else 'scoreB' end;
        v_payload := jsonb_set(
          v_payload,
          array['rounds', v_round_idx::text, 'matches', v_match_idx::text, v_field],
          to_jsonb(v_sub.value)
        );
      end if;
    end if;
  end loop;

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
