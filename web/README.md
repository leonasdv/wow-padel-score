# WOWPadel Score — live share page

A static, dependency-free page that shows a published event's rounds and standings, updating
every 5 seconds. No build step — just HTML/CSS/vanilla JS.

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

Any static host works — point it at this `web/` folder as the site root, no build command:

- **Vercel**: New Project → Root Directory `web` → Framework Preset "Other" → deploy.
- **Netlify**: New site from Git → Base directory `web`, no build command, publish directory `web`.
- **GitHub Pages**: serve the `web/` folder (e.g. via a `gh-pages` branch or Pages "from a
  folder" setting).

Once deployed, set `EXPO_PUBLIC_SHARE_BASE_URL` in the app's `.env` to that URL so the
in-app "Copy link"/"Share" actions produce a working `https://.../?e=<shareId>` link.
