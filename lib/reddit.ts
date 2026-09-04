// Convert a Reddit community (subreddit) URL into the subreddit's native
// RSS/Atom feed.
//
// Reddit exposes a public feed at
//     https://www.reddit.com/r/<name>/.rss           (front page / hot)
//     https://www.reddit.com/r/<name>/<sort>/.rss    (top, new, rising, ...)
// (old.reddit.com / np.reddit.com behave the same way.)
//
// This is intentionally a pure, dependency-free URL transform — no network,
// no page scrape — so it is fast and deterministic (issue #46). If the URL is
// not a subreddit we can positively identify, we return `null` and the caller
// stores the URL as-is (behaves exactly as before for non-reddit links).

const REDDIT_HOSTS = new Set([
  'www.reddit.com',
  'reddit.com',
  'old.reddit.com',
  'np.reddit.com',
  'amp.reddit.com',
]);

const SORTS = new Set(['hot', 'new', 'top', 'rising', 'controversial']);

export interface ResolvedRedditFeed {
  feedUrl: string;
  /** Community name the user pointed at (e.g. "space"), best-effort. */
  community: string | null;
  /** The raw url the user typed (for provenance / `resolved_from`). */
  resolvedFrom: string | null;
}

interface Parsed {
  protocol: string;
  host: string;
  path: string; // raw (URL-encoded), normalised to have no leading/trailing slashes
}

function parseReddit(url: string): Parsed | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!u.protocol) return null;
  const host = u.hostname.toLowerCase();
  if (!REDDIT_HOSTS.has(host)) return null;
  return {
    protocol: u.protocol,
    host: u.host,
    path: u.pathname.replace(/^\/+|\/+$/g, ''),
  };
}

function decodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * If `rawUrl` points at a Reddit *community*, return its canonical RSS feed
 * url (plus the community name). Returns `null` when the URL is not a
 * recognisable subreddit.
 *
 *   https://www.reddit.com/r/space        -> https://www.reddit.com/r/space/.rss
 *   https://old.reddit.com/r/space/       -> https://old.reddit.com/r/space/.rss
 *   https://www.reddit.com/r/space/top    -> https://www.reddit.com/r/space/top/.rss
 *                                           (sort window kept: .../top/.rss?t=week)
 *   https://www.reddit.com/r/space/.rss   -> returned unchanged (already a feed)
 *
 * Query params the user supplied (e.g. `?t=week`) are preserved — the `.rss`
 * endpoint honours sort-window params and ignores the rest.
 */
export function resolveRedditFeed(rawUrl: string): ResolvedRedditFeed | null {
  const p = parseReddit(rawUrl);
  if (!p) return null;
  if (!p.path) return null; // bare domain — not a community

  const segments = p.path.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== 'r') return null;

  const name = decodeSegment(segments[1]);
  if (!name) return null;

  // Preserve the community name's casing (subreddit names are case-sensitive),
  // while the `r` root and the sort key stay canonical.
  const encodedName = encodeURIComponent(name);

  // Already a .rss feed URL — leave it alone (best-effort: still report it).
  // Match the trailing ".rss" on the raw path (case-insensitive, per reddit).
  if (/\.rss$/i.test(decodeSegment(segments[segments.length - 1] || ''))) {
    return {
      feedUrl: rawUrl,
      community: name || null,
      resolvedFrom: rawUrl,
    };
  }

  // A sort (hot/top/new/rising/controversial) on the community page.
  let sort: string | null = null;
  if (segments.length >= 3 && SORTS.has(segments[2].toLowerCase())) {
    sort = segments[2].toLowerCase();
  }

  const feedPath =
    `r/${encodedName}/${sort ? `${sort}/` : ''}.rss`;
  const feedUrl = `${p.protocol}//${p.host}/${feedPath}`;

  // Keep any query the user provided (e.g. ?t=week for the top sort window);
  // the .rss endpoint honours sort-window params.
  let q = '';
  try {
    const orig = new URL(rawUrl);
    if (orig.search) q = orig.search;
  } catch {
    q = '';
  }

  return {
    feedUrl: feedUrl + q,
    community: name,
    resolvedFrom: rawUrl,
  };
}

/** Cheap, no-network check: does this URL look like a Reddit community? */
export function isRedditCommunityUrl(rawUrl: string): boolean {
  return resolveRedditFeed(rawUrl) !== null;
}
