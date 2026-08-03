-- WOWPadel Score — shareable rounds & standings
--
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
--
-- Design: the table itself grants NO direct access to anon/authenticated roles.
-- All reads/writes go through the three SECURITY DEFINER functions below, so the
-- public anon key can never be used to dump every published event — only the
-- exact share_id a caller already knows, and only edits authorized by the
-- matching edit_token.

create extension if not exists pgcrypto;

create table if not exists public.shared_events (
  id uuid primary key default gen_random_uuid(),
  share_id text unique not null,
  edit_token text unique not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_events enable row level security;
-- Intentionally no policies: with RLS on and zero policies, anon/authenticated
-- have zero direct SELECT/INSERT/UPDATE/DELETE access via PostgREST or the
-- client library. Only the SECURITY DEFINER functions below (owned by the
-- table owner) can touch the table, bypassing RLS internally.

revoke all on public.shared_events from anon, authenticated;

create or replace function public.create_shared_event(
  p_share_id text,
  p_edit_token text,
  p_payload jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into shared_events (share_id, edit_token, payload)
  values (p_share_id, p_edit_token, p_payload);
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

create or replace function public.get_shared_event(p_share_id text)
returns table(payload jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select payload, updated_at from shared_events where share_id = p_share_id;
$$;

grant execute on function public.create_shared_event(text, text, jsonb) to anon, authenticated;
grant execute on function public.update_shared_event(text, text, jsonb) to anon, authenticated;
grant execute on function public.unpublish_shared_event(text, text) to anon, authenticated;
grant execute on function public.get_shared_event(text) to anon, authenticated;
