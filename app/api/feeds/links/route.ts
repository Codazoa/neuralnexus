import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/key';
import Parser from 'rss-parser';
import { channelFromFeedUrl, extractChannelNameFromHtml } from '@/lib/youtube';

// GET /api/feeds/links
// Returns the user's feeds' items (newest-first), aggregated across feeds.
//
//   items:          Item[]            sorted newest-first
//   failedFeeds:    { label, url, error? }[]
//                   feeds that could not be fetched this cycle AND had no
//                   usable cache to fall back to (see `staleNote`).
//   servedFromCache?: 'fresh' | 'stale'
//                   'fresh'  — every item was cached within the TTL (no
//                              upstream request was made at all; this is the
//                              anti rate-limit path of issue #27).
//                   'stale'  — at least one item came from the last successful
//                              fetch because the upstream fetch failed this
//                              time.
//
// Caching (issue #27): for each subscribed feed, if we have a cache row from
// within CACHE_TTL_MS we serve it without touching the upstream provider.
// This is what stops "YouTube rate-limits me once I hammer refresh" — the
// provider is only hit once per TTL window regardless of how many times the
// user reloads or hits Refresh.
//
// On a fresh-fetch failure we fall back to the last successful fetch up to
// STALE_MAX_AGE_MS in the past — so a transient blip does not empty the feed.
// After that we report the feed as failed and the Refresh button (issue #25)
// is the way the user retries.
//
// Optional `?category=<name>` filter: only include items from feeds filed
// under that category (case-insensitive match on the category name).

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const PARSER_OPTS = {
  timeout: 20000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; neuralnexus/0.0; RSS)' },
  customFields: {
    item: ['media:thumbnail', 'media:content', 'enclosure', 'yt:videoId'],
  },
};

// --- helpers ----------------------------------------------------------------

/**
 * Self-heals YouTube feeds that arrived with a null name (the issue #26 code
 * path that leaves the UI showing "youtube.com"). When we have a canonical
 * channel feed url but no stored name, we fetch the channel page to learn its
 * display name, then persist it. Best-effort: any failure returns null so the
 * caller keeps the hostname fallback exactly as it did before.
 *
 * `rowName` is the currently-stored name (may be null). We only attempt the
 * fetch when it's still unset — once a name is present (user-entered or learned)
 * we never overwrite it here.
 */
async function learnYouTubeName(
  feedUrl: string,
  rowName: string | null
): Promise<string | null> {
  if ((rowName || '').trim()) return null; // respect existing name (user or learned)
  const ch = channelFromFeedUrl(feedUrl);
  if (!ch) return null;
  try {
    // Fetch the channel's /about page — the document <title>/og:title there is
    // the channel name, and it does not depend on the YouTube RSS feed being
    // reachable (which is what failed in issue #29).
    const aboutUrl = `https://www.youtube.com/channel/${ch}/about`;
    const r = await fetch(aboutUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; neuralnexus/0.0; RSS feed name)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const name = extractChannelNameFromHtml(html);
    if (name && /^\d/.test(name) === false) return name; // skip accidental pure-numeric
    return null;
  } catch {
    return null;
  }
}

/**
 * Pull a thumbnail url out of the various shapes a feed can expose:
 *  - a plain string
 *  - { url: string }
 *  - an array of either of the above (keepArray or multi-element)
 */
function thumbnailFromAny(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    for (const v of val) {
      const t = thumbnailFromAny(v);
      if (t) return t;
    }
    return null;
  }
  if (typeof val === 'object') {
    const v = (val as Record<string, unknown>).url;
    if (typeof v === 'string') return v;
  }
  return null;
}

/**
 * A human label for a feed that cannot be resolved any cleaner way.
 * Hostname of the feed URL, with the leading `www.` stripped.
 */
function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface FeedItem {
  title: string | undefined;
  link: string | undefined;
  pubDate: string | undefined;
  categories: string[] | undefined;
  source: string;
  thumbnail: string | null;
  videoId: string | null;
  feedCategories: string[];
  /** HTML content of the entry (issue #33) — shown when the card expands. */
  content: string | null;
}

export interface FailedFeed {
  label: string;
  url: string;
  error?: string;
}

export interface FeedLinksResponse {
  items: FeedItem[];
  failedFeeds: FailedFeed[];
  servedFromCache?: 'fresh' | 'stale';
}

interface ParsedRow {
  id: string;
  userId: string;
  feed_url: string;
  name: string | null;
  categories: { category: { name: string } }[];
}

interface CacheRow {
  name: string | null;
  source: string;
  items: string; // JSON array of FeedItem (without feedCategories — that
                  // is re-attached to each item below so the response rows
                  // carry the live category list from the db.)
  lastFetchedAt: Date;
}

/**
 * Shape a parsed feed's raw items into the annotated rows the API returns.
 */
function shapeItems(
  rawItems: any[],
  source: string,
  feedCats: string[]
): FeedItem[] {
  return rawItems.map((rawIt: any): FeedItem => {
    const videoId = (rawIt['yt:videoId'] && String(rawIt['yt:videoId'])) || null;

    let thumbnail: string | null = null;
    thumbnail =
      thumbnailFromAny(rawIt['media:thumbnail']) ||
      thumbnailFromAny(rawIt['media:content']) ||
      null;
    if (!thumbnail && rawIt.enclosure) {
      const enc = rawIt.enclosure as Record<string, unknown>;
      const encType = String(enc.type || '');
      // Prefer enclosures that are actually images.
      if (!encType || encType.startsWith('image/')) {
        thumbnail =
          thumbnailFromAny(enc) || (typeof enc.url === 'string' ? enc.url : null);
      }
    }
    // YouTube video entries always have a thumbnail at this well-known URL
    // even when the feed nests it inside <media:group>.
    if (!thumbnail && videoId) {
      thumbnail = `https://i1.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }

    return {
      title: rawIt.title,
      link: rawIt.link,
      pubDate: rawIt.pubDate,
      categories: rawIt.categories,
      source,
      thumbnail,
      videoId,
      feedCategories: feedCats,
      // Entry body (issue #33): rss-parser exposes `content` (html) or
      // `contentSnippet` (text) by default; normalise to a single field.
      content: (typeof rawIt.content === 'string' && rawIt.content.trim())
        ? rawIt.content
        : (typeof rawIt.contentSnippet === 'string' && rawIt.contentSnippet.trim())
        ? rawIt.contentSnippet
        : null,
    };
  });
}

function sortByPubDateDesc(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    const pa = a.pubDate ? new Date(a.pubDate) : new Date(0);
    const pb = b.pubDate ? new Date(b.pubDate) : new Date(0);
    return pb.getTime() - pa.getTime();
  });
}

/** Fetch + parse a remote feed. Throws on any failure (network or parse). */
async function freshFeed(url: string) {
  const parser = new Parser(PARSER_OPTS);
  const feed = await parser.parseURL(url);
  if (!feed) throw new Error('empty feed');
  return feed;
}

/** Resolve the label shown for a feed. Stored name > feed <title> > hostname. */
function labelFor(row: ParsedRow, feed: { title?: string } | null): string {
  const stored = (row.name || '').trim();
  if (stored) return stored;
  if (feed?.title) {
    const t = feed.title.trim();
    if (t) return t;
  }
  return hostnameLabel(row.feed_url);
}

/**
 * Try to write (or update) this feed's cache row.
 * Never throws — a cache write failure must not take down the GET.
 */
async function upsertCache(params: {
  userId: string;
  feedId: string;
  name: string | null;
  source: string;
  items: FeedItem[];
}) {
  try {
    await prisma.feedCache.upsert({
      where: {
        userId_feedId: {
          userId: params.userId,
          feedId: params.feedId,
        },
      },
      create: {
        userId: params.userId,
        feedId: params.feedId,
        name: params.name,
        source: params.source,
        items: JSON.stringify(params.items),
        lastFetchedAt: new Date(),
      },
      update: {
        name: params.name,
        source: params.source,
        items: JSON.stringify(params.items),
        lastFetchedAt: new Date(),
      },
    });
  } catch {
    // Swallow a cache-write error: we still have the in-memory items to serve.
  }
}

// --- route -------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const wanted = (req.nextUrl.searchParams.get('category') || '').trim().toLowerCase();

  const feed_list: ParsedRow[] = await prisma.feeds.findMany({
    where: { userId: user.id },
    include: {
      categories: {
        select: { category: { select: { name: true } } },
        orderBy: { categoryId: 'asc' },
      },
    },
  });

  const rows: ParsedRow[] = wanted
    ? feed_list.filter((f) =>
        f.categories.some((c) => c.category.name.toLowerCase() === wanted)
      )
    : feed_list;

  const feed_rows = rows.slice(0, 100);

  // Cache rows for everything we might serve.
  // (Map: userId_feedId -> row)
  const cacheRows = feed_rows.length
    ? await prisma.feedCache.findMany({
        where: { userId: user.id, feedId: { in: feed_rows.map((r) => r.id) } },
      })
    : [];
  const cacheFor = new Map<string, CacheRow>(
    cacheRows.map((c) => [`${c.userId}|${c.feedId}`, c])
  );

  const now = Date.now();
  const items: FeedItem[] = [];
  const failedFeeds: FailedFeed[] = [];
  let anythingFromCached = false; // true when any item we serve came from cache
  let anyStale = false; // true when any item we serve is from a stale cache

  await Promise.all(
    feed_rows.map(async (row) => {
      const feedCats = row.categories.map((c) => c.category.name);
      const cached = cacheFor.get(`${user.id}|${row.id}`);

      // (1) Serve fresh-from-cache if within the TTL (issue #27: the
      //     anti rate-limit path). No upstream request is made at all.
      if (cached && now - cached.lastFetchedAt.getTime() < CACHE_TTL_MS) {
        let rawIt: FeedItem[] = [];
        try {
          const parsed = JSON.parse(cached.items) as FeedItem[];
          if (Array.isArray(parsed)) rawIt = parsed;
        } catch {
          rawIt = [];
        }
        for (const it of rawIt) {
          items.push({ ...it, feedCategories: feedCats, source: it.source || cached.source });
        }
        anythingFromCached = true;
        return;
      }

      // (2) Fresh fetch (+ one retry after a short backoff — this is the
      //     issue-25 fix for transient timeouts: a flake gets a second
      //     chance, and if it still fails we fall back to (3)).
      const label = labelFor(row, null);
      let attemptError: unknown = null;
      let parsed: any = null;

      try {
        parsed = await freshFeed(row.feed_url);
      } catch (e) {
        attemptError = e;
      }
      if (!parsed && attemptError) {
        await new Promise((r) => setTimeout(r, 250));
        try {
          parsed = await freshFeed(row.feed_url);
        } catch (e2) {
          attemptError = e2;
        }
      }

      if (parsed) {
        let source = labelFor(row, parsed as any);
        // Self-heal: a YouTube feed that has no stored name (issue #29 left it
        // as "youtube.com") gets its channel name learned + persisted now that we
        // have a successful fetch to hook onto. This is the path that fixes the
        // *existing* feeds the user is complaining about.
        if (!(row.name || '').trim() && channelFromFeedUrl(row.feed_url)) {
          const learned = await learnYouTubeName(row.feed_url, row.name);
          if (learned) {
            await prisma.feeds.update({ where: { id: row.id }, data: { name: learned } }).catch(() => {});
            source = learned;
          }
        }
        const raw = parsed.items || [];
        if (raw.length === 0) {
          // Reachable but empty — treat as "failed" unless we have a cache.
          if (cached && now - cached.lastFetchedAt.getTime() < STALE_MAX_AGE_MS) {
            let cachedItems: FeedItem[] = [];
            try { cachedItems = JSON.parse(cached.items) as FeedItem[]; } catch { cachedItems = []; }
            for (const it of cachedItems) {
              items.push({ ...it, feedCategories: feedCats, source: it.source || cached.source });
            }
            anythingFromCached = true;
            anyStale = true;
            return;
          }
          failedFeeds.push({ label, url: row.feed_url, error: 'empty feed' });
          return;
        }
        const shaped = shapeItems(raw, source, feedCats);
        items.push(...shaped);
        // Persist the fresh pull so the next request within the TTL is served
        // straight from disk (issue #27).
        await upsertCache({
          userId: user.id,
          feedId: row.id,
          name: cached?.name ?? row.name,
          source,
          items: shaped,
        });
        return;
      }

      // (3) Fresh fetch failed — use stale cache if we have one within the
      //     window, else report the feed as failed.
      if (cached && now - cached.lastFetchedAt.getTime() < STALE_MAX_AGE_MS) {
        let cachedItems: FeedItem[] = [];
        try { cachedItems = JSON.parse(cached.items) as FeedItem[]; } catch { cachedItems = []; }
        for (const it of cachedItems) {
          items.push({ ...it, feedCategories: feedCats, source: it.source || cached.source });
        }
        anythingFromCached = true;
        anyStale = true;
        return;
      }

      failedFeeds.push({
        label,
        url: row.feed_url,
        error: attemptError instanceof Error ? attemptError.message : String(attemptError),
      });
    })
  );

  const body: FeedLinksResponse = {
    items: sortByPubDateDesc(items),
    failedFeeds,
  };
  if (anythingFromCached) {
    body.servedFromCache = anyStale ? 'stale' : 'fresh';
  }
  // If every item came from a fresh fetch this cycle but some feeds failed,
  // those feeds are already in `failedFeeds` above. If every item we served
  // came from the (possibly stale) cache, `servedFromCache` is set.
  return NextResponse.json(body);
}
