# Supabase setup — shareable rounds & standings

One-time setup for the live share-link feature.

## 1. Run the schema

Open your Supabase project → **SQL Editor** → **New query**, paste the contents of
[`schema.sql`](./schema.sql), and run it. This creates:

- `shared_events` — a table with Row Level Security enabled and **no policies**, so the
  public anon key can never read or list it directly.
- Four `SECURITY DEFINER` functions (`create_shared_event`, `update_shared_event`,
  `unpublish_shared_event`, `get_shared_event`) that the app and the public web viewer call
  instead. They're the only way in: publishing/updating requires knowing the private
  `edit_token`, reading requires knowing the public `share_id` embedded in the link.

Safe to re-run — everything uses `create or replace` / `if not exists`.

## 2. Get your Project URL and anon key

Project → **Settings → API**. You need:

- **Project URL** (e.g. `https://xxxxx.supabase.co`)
- **anon / public key** (NOT the `service_role` key — that one must never leave the
  Supabase dashboard)

## 3. Wire it into the app

Copy `.env.example` to `.env` in the repo root and fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

`.env` is gitignored — never commit it.

## 4. Wire it into the public web viewer

Edit `web/config.js` with the same URL + anon key. Unlike `.env`, this file **is** committed
and deployed publicly — that's expected: the anon key here only unlocks the four RPC
functions above, which enforce their own authorization (share_id/edit_token), so there's
nothing sensitive in it.
