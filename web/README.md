# WOWPadel Score — live share page

A static, dependency-free page that shows a published event's rounds and standings, updating
every 60 seconds. No build step — just HTML/CSS/vanilla JS.

## Configure

Edit [`config.js`](./config.js) with your Supabase Project URL and anon key (Settings → API in
the Supabase dashboard). This file is meant to be public/deployed — see the comment inside it
and [`../supabase/README.md`](../supabase/README.md) for why that's safe here.

## Run locally

```
npx serve web
```

Then open `http://localhost:3000/?e=<shareId>` — get a real `shareId` by publishing an event
from the app (Edit event → Live share link, or the "Share live" button on the Dashboard).

## Deploy

**GitHub Pages (this repo's setup)**: [`../.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml)
publishes this folder automatically on every push that touches `web/**` (or via manual
"Run workflow" from the Actions tab). One-time setup: repo Settings → Pages → Build and
deployment → Source → **GitHub Actions**. Once live, the page is served at:

```
https://leonasdv.github.io/wow-padel-score/
```

So a share link looks like `https://leonasdv.github.io/wow-padel-score/?e=<shareId>`.

Other static hosts work too, if you'd rather not use Pages — point them at this `web/`
folder as the site root, no build command:

- **Vercel**: New Project → Root Directory `web` → Framework Preset "Other" → deploy.
- **Netlify**: New site from Git → Base directory `web`, no build command, publish directory `web`.

Whichever host you use, set `EXPO_PUBLIC_SHARE_BASE_URL` in the app's `.env` to that URL so the
in-app "Copy link"/"Share" actions produce a working `https://.../?e=<shareId>` link.
