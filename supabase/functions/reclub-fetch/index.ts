// Fetches a Reclub event page server-side so the client never has to deal with
// reclub.co not sending CORS headers (this bites the web/PWA build; native apps
// aren't subject to browser CORS at all). Restricted to reclub.co URLs only —
// this is a public, unauthenticated endpoint and must not become an open proxy.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  let url: unknown;
  try {
    ({ url } = await req.json());
  } catch {
    return json({ error: 'Expected a JSON body with a "url" field.' }, 400);
  }

  if (typeof url !== 'string' || !/^https:\/\/reclub\.co\//i.test(url)) {
    return json({ error: 'Only reclub.co URLs are allowed.' }, 400);
  }

  try {
    const res = await fetch(url, { headers: { Accept: 'text/html' } });
    if (!res.ok) return json({ error: `Reclub responded with HTTP ${res.status}.` }, 502);
    const html = await res.text();
    return json({ html });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Could not reach Reclub.' }, 502);
  }
});
