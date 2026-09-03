import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/key';
import Parser from 'rss-parser';

// GET /api/feeds/links
// Fetch all of the user's RSS feeds in parallel and return the aggregated,
// newest-first list of items. Each item is annotated with:
//   - source:          display label for the feed (title or hostname)
//   - thumbnail:       best url we could find (media:thumbnail / enclosure / derived)
//   - videoId:         YouTube video id when the entry is a video (from yt:videoId)
//   - feedCategories:  names of the categories the feed is filed under (issue #20)
//
// Response shape (issue #25):
//   {
//     items: Item[],              // sorted newest-first
//     failedFeeds: { label, url, error? }[]  // feeds that couldn't be fetched
//   }
//
// Optional `?category=<name>` filter: only include items whose feed belongs
// to that category (case-insensitive match on the category name).
//
// A hard 401 is returned only for missing/invalid auth. A feed that times out
// or 500s is *not* an error — it lands in `failedFeeds` so the UI can tell the
// user which feeds didn't load this time and let them press Refresh. A single
// retry with a short backoff is attempted before a feed is reported as failed
// (this is what fixes the "YouTube feed sometimes missing, fixed by
// refreshing" symptom: transient upstream timeouts that used to be dropped
// silently are now retried and surfaced).

const PARSER_OPTS = {
  timeout: 20000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; neuralnexus/0.0; RSS)' },
  customFields: {
    item: ['media:thumbnail', 'media:content', 'enclosure', 'yt:videoId'],
  },
};

// --- helpers -----------------------------------------------------------------

/**
 * Pull a thumbnail url out of the various shapes a feed can expose:
 *  - a plain string
 *  - { url: string }
 *  - an array of either of the above (keepArray or multi-element)
 * Returns null when nothing usable is found.
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
 * Return a human-facing label for the feed. Prefer the feed's own <title>
 * (e.g. "The Verge", "Fireship"); fall back to the hostname of the feed URL
 * if the feed doesn't declare one.
 */
function feedLabel(feed: { title?: string; link?: string }): string {
  const title = (feed.title || '').trim();
  if (title) return title;
  const href = feed.link;
  if (href) {
    try {
      return new URL(href).hostname.replace(/^www\./, '');
    } catch {
      /* fall through */
    }
  }
  return 'Unknown source';
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
}

export interface FailedFeed {
  label: string;
  url: string;
  error?: string;
}

export interface FeedLinksResponse {
  items: FeedItem[];
  failedFeeds: FailedFeed[];
}

interface ParsedRow {
  id: string;
  userId: string;
  feed_url: string;
  categories: { category: { name: string } }[];
}

/**
 * Fetch + parse a single remote feed. Throws on any fetch/parse failure.
 * Returns the raw Parser feed. Kept as a pure network helper so the caller
 * can run a retry against the exact same call.
 */
async function fetchFeed(url: string) {
  const parser = new Parser(PARSER_OPTS);
  const feed = await parser.parseURL(url);
  if (!feed) throw new Error('empty feed');
  return feed;
}

/**
 * Shape a parsed feed's raw items into the annotated rows the API returns.
 * (Split from the fetch path so the caller can retry the network call without
 * re-doing the shaping.)
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
    // even when the feed nests it inside <media:group> (rss-parser doesn't
    // expose that to customFields).
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

// Fallback label for feeds that fail to parse: derive it from the stored feed
// URL so the user can see *which* feed didn't load.
function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function sourceLabel(feed: { title?: string; link?: string }, fallbackUrl: string): string {
  const fromFeed = feedLabel(feed);
  if (fromFeed !== 'Unknown source') return fromFeed;
  const fromUrl = hostnameLabel(fallbackUrl);
  if (fromUrl) return fromUrl;
  return 'Unknown source';
}

// --- route -------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const wanted = (
    req.nextUrl.searchParams.get('category') || ''
  ).trim().toLowerCase();

  const feed_list: ParsedRow[] = await prisma.feeds.findMany({
    where: { userId: user.id },
    include: {
      categories: {
        select: { category: { select: { name: true } } },
        orderBy: { categoryId: 'asc' },
      },
    },
  });

  const rows = wanted
    ? feed_list.filter((f) =>
        f.categories.some((c) => c.category.name.toLowerCase() === wanted)
      )
    : feed_list;

  const feed_rows = rows.slice(0, 100);
  const items: FeedItem[] = [];
  const failedFeeds: FailedFeed[] = [];

  await Promise.all(
    feed_rows.map(async (row) => {
      const url = row.feed_url;
      const feedCats = row.categories.map((c) => c.category.name);
      let attemptError: unknown = null;

      // Attempt 1.
      let parsed: any = null;
      try {
        parsed = await fetchFeed(url);
      } catch (e) {
        attemptError = e;
      }

      // Attempt 2 — a single retry after a short backoff. This is the fix for
      // the transient-timeout symptom on YouTube (and any) feeds reported in
      // issue #25: a flake that used to be dropped silently now gets a second
      // chance, and if it still fails it is surfaced in `failedFeeds`.
      if (!parsed && attemptError) {
        await new Promise((r) => setTimeout(r, 250));
        try {
          parsed = await fetchFeed(url);
        } catch (e2) {
          attemptError = e2;
        }
      }

      if (!parsed) {
        failedFeeds.push({
          label: hostnameLabel(url),
          url,
          error: attemptError instanceof Error ? attemptError.message : String(attemptError),
        });
        return;
      }

      const source = sourceLabel(parsed as any, url);
      const rawItems: any[] = parsed.items || [];
      if (rawItems.length === 0) {
        // Reachable but empty — treat as "failed" so the user can see it.
        failedFeeds.push({ label: source, url, error: 'empty feed' });
        return;
      }
      items.push(...shapeItems(rawItems, source, feedCats));
    })
  );

  const body: FeedLinksResponse = {
    items: sortByPubDateDesc(items),
    failedFeeds,
  };
  return NextResponse.json(body);
}
