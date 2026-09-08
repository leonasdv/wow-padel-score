# Supabase setup — shareable rounds & standings

One-time setup for the live share-link feature.

## 1. Run the schema

Open your Supabase project → **SQL Editor** → **New query**, paste the contents of
[`schema.sql`](./schema.sql), and run it. This creates:

- `shared_events` — a table with Row Level Security enabled and **no policies**, so the
  public anon key can never read or list it directly.
- `shared_event_score_submissions` — same lockdown; an append-only queue of scores submitted
  from the web score-entry link, drained by the app.
- A set of `SECURITY DEFINER` functions that the app and the public web pages call instead of
  touching the tables directly. Two secret tokens gate them, kept deliberately separate:
  - `edit_token` — private, held only by the organizer's app. Publishing, updating, unpublishing,
    toggling who's allowed to enter scores, and draining the score queue all require it.
  - `editor_token` — meant to be handed out on a separate "Score entry" link. Can only submit
    individual match scores (`submit_shared_score`), and only while the organizer has toggled
    that event to web input.
  - Plain reading (`get_shared_event`) only needs the public `share_id` embedded in the viewer
    link.

Safe to re-run any time this file changes — every statement is idempotent, including against a
project that already has the previous version of this schema.

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
and deployed publicly — that's expected: the anon key here only unlocks the RPC functions
above, which enforce their own authorization (share_id / edit_token / editor_token), so
there's nothing sensitive in it.

## 5. Deploy the Reclub fetch function (once)

`functions/reclub-fetch` fetches a Reclub event page server-side for the Reclub-import
feature — reclub.co sends no CORS headers, which only matters on the web/PWA build (native
apps aren't subject to browser CORS). Deploy it once, and again whenever it changes:

```
npx supabase login
npx supabase link --project-ref sqkiemhdcxgilyydwauo
npx supabase functions deploy reclub-fetch --no-verify-jwt
```

`--no-verify-jwt` matches the RPC functions above: the anon key is enough, and the function
itself only allows fetching `reclub.co` URLs (never an open proxy).
