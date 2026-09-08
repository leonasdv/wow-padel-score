const CORS_PROXIES = [
  (url: string) => url,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

/** Reclub RSVP messages are shared as plain text with the event link mixed in. */
export function extractReclubUrl(text: string): string | null {
  const match = text.match(/https?:\/\/reclub\.co\/\S+/i);
  if (!match) return null;
  return match[0].replace(/[.,;!?)\]}'"]+$/, '');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  '#x2F': '/',
  '#x27': "'",
  nbsp: ' ',
};

function decodeHtmlEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (whole, code: string) => {
    const key = code.toLowerCase();
    if (key in NAMED_ENTITIES) return NAMED_ENTITIES[key];
    if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10));
    return whole;
  });
}

/**
 * The confirmed list sits between the "Dikonfirmasi"/"Confirmed" heading and the next
 * section heading (waitlist/invited). Both that heading and the event organizer avatars
 * above it reuse the same avatar-name <p> class, so the search must start after the
 * confirmed heading to avoid picking up the organizer names.
 */
export function parseConfirmedNames(html: string): string[] {
  const heading = html.match(/<p[^>]*>\s*(?:Dikonfirmasi|Confirmed)[\s\S]{0,80}?<\/p>/i);
  if (!heading || heading.index == null) return [];

  const start = heading.index + heading[0].length;
  const rest = html.slice(start, start + 20000);
  const nextHeading = rest.search(/<p[^>]*class="[^"]*font-bold text-lg[^"]*"/i);
  const segment = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

  const names: string[] = [];
  const nameRe = /<p class="[^"]*font-semibold[^"]*truncate[^"]*w-16[^"]*">([^<]*)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(segment))) {
    const name = decodeHtmlEntities(m[1]).trim();
    if (name) names.push(name);
  }
  return names;
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;
  for (const withProxy of CORS_PROXIES) {
    try {
      const res = await fetch(withProxy(url), { headers: { Accept: 'text/html' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > 200) return text;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not reach that Reclub page.');
}

export async function fetchReclubConfirmedNames(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  const names = parseConfirmedNames(html);
  if (names.length === 0) {
    throw new Error('No confirmed players found on that Reclub page.');
  }
  return names;
}
