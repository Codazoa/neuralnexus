// Resolve a user-entered YouTube URL to the channel's native RSS feed.
//
// A YouTube *channel* (not a video, playlist, or search) has a public RSS feed
// at https://www.youtube.com/feeds/videos.xml?channel_id=UC... . The `channel_id`
// ("channelId" / "externalId") is a base64-ish string that always starts with `UC`
// followed by 22 chars (24 total). We extract it from the channel page source and
// return the canonical feed URL instead of the raw URL the user typed — that way the
// reader actually has a working feed to parse (issue #13).
//
// This is intentionally dependency-free and conservative: if we can't positively
// identify a channel id we return `null` and the caller falls back to treating the
// URL as an ordinary feed url.

const CHANNEL_ID = /^[A-Za-z0-9_-]{24}$/; // UC + 22 (matches YouTube's channel id shape)

const FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

const YOUTUBE_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'www.m.youtube.com',
]);

interface Parsed {
  host: string;
  pathnameRaw: string; // raw pathname (still URL-encoded)
  query: URLSearchParams;
}

function parseYt(url: string): Parsed | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(u.hostname.toLowerCase())) return null;
  // pathname keeps leading slash; we strip it and decode manually per-segment below.
  return { host: u.hostname.toLowerCase(), pathnameRaw: u.pathname.replace(/^\/+/, ''), query: u.searchParams };
}

function looksLikeChannelId(id: string | null | undefined): id is string {
  return !!id && id.length === 24 && id.startsWith('UC') && CHANNEL_ID.test(id);
}

function fetchText(url: string): Promise<string> {
  return fetch(url, {
    method: 'GET',
    headers: {
      // A plain browser-ish UA avoids the "please enable JS" interstitial.
      'User-Agent':
        'Mozilla/5.0 (compatible; neuralnexus/0.0; RSS feed resolution)',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    // Don't let the caller's request timeout hang the page.
    signal: AbortSignal.timeout(12_000),
  }).then((r) => (r.ok ? r.text() : Promise.reject(new Error('fetch failed'))));
}

// Pull a channel id out of fetched channel-page HTML. Ordered most→least reliable.
export function extractChannelIdFromHtml(html: string): string | null {
  // 1) The canonical feed link is present on channel pages: feeds/videos.xml?channel_id=UC...
  let m = html.match(/feeds\/videos\.xml\?channel_id=([A-Za-z0-9_-]{24})/);
  if (m) return m[1];

  // 2) JSON-embedded channel id.
  m = html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/);
  if (m) return m[1];

  m = html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/);
  if (m) return m[1];

  // 3) Canonical channel URL in the HTML.
  m = html.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (m) return m[1];

  // 4) Any channel_id= query we can find.
  m = html.match(/channel_id=(UC[A-Za-z0-9_-]{22})/);
  if (m) return m[1];

  return null;
}

/**
 * If `rawUrl` points at a YouTube *channel*, return its canonical RSS feed url.
 * Returns `null` when the URL is not a YouTube channel (or can't be resolved).
 *
 * Fast path: `https://www.youtube.com/channel/UC...`, `/@handle`, `?channel_id=UC...`,
 * or an explicit feed url. `c/`, `@handle`, and bare video/watch links require fetching
 * the page once to learn the channel id.
 */
export async function resolveYouTubeFeed(rawUrl: string): Promise<string | null> {
  const p = parseYt(rawUrl);
  if (!p) return null;

  const urlLower = rawUrl.toLowerCase();

  // Already a feed url — normalize and return as-is.
  if (/\/feeds\/videos\.xml/.test(p.pathnameRaw)) {
    const cid = p.query.get('channel_id') || p.query.get('channelId');
    if (looksLikeChannelId(cid)) return `${FEED_BASE}${cid}`;
    const m = p.pathnameRaw.match(/channel_id=(UC[A-Za-z0-9_-]{22})/);
    if (m) return `${FEED_BASE}${m[1]}`;
    return null; // feed url but no valid channel id -> nothing to do
  }

  // Query param channel_id (some pages/shortlinks carry it).
  const qid = p.query.get('channel_id') || p.query.get('channelId');
  if (looksLikeChannelId(qid)) return `${FEED_BASE}${qid}`;

  const segments = p.pathnameRaw.split('/').filter(Boolean);
  const first = segments[0] ?? '';

  // /channel/UC...  (id is right there; no fetch needed)
  if (first === 'channel' && segments.length >= 2) {
    const id = decodeURIComponent(segments[1]);
    if (looksLikeChannelId(id)) return `${FEED_BASE}${id}`;
  }

  // Anything that isn't an obvious non-channel page: fetch and extract.
  // Exclude things that can't map to a single channel — better to return null
  // than save a feed that isn't a channel.
  const nonChannel = ['watch', 'playlist', 'shorts', 'results', 'search', 'live', 'embed', 'gaming', 'podcasts', 'premium'];
  if (nonChannel.includes(first)) return null;

  // @handle / c/handle / bare channel page: fetch once for the channel id.
  try {
    const html = await fetchText(rawUrl);
    const id = extractChannelIdFromHtml(html);
    if (id) return `${FEED_BASE}${id}`;
  } catch {
    // fall through: unresolvable
  }
  return null;
}

/** Cheap, no-network check: does this URL look like a YouTube channel URL? */
export function isYouTubeChannelUrl(rawUrl: string): boolean {
  const p = parseYt(rawUrl);
  if (!p) return false;
  if (/\/feeds\/videos\.xml/.test(p.pathnameRaw)) return true;
  const qid = p.query.get('channel_id') || p.query.get('channelId');
  if (looksLikeChannelId(qid)) return true;
  const seg = p.pathnameRaw.split('/').filter(Boolean);
  const first = seg[0] ?? '';
  if (first === 'channel' && looksLikeChannelId(decodeURIComponent(seg[1] ?? ''))) return true;
  if (first === 'c' || first.startsWith('@')) return true;
  return false;
}
