import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/key';
import Parser from 'rss-parser';

interface FeedLinks {
  id: string;
  userId: string;
  feed_url: string;
}

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
 * (e.g. "The Verge", "Fireship"); fall back to the hostname of the feed
 * URL if the feed doesn't declare one.
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

// GET /api/feeds/links
// Fetch the user's subscribed feeds and aggregate the latest items,
// sorted newest-first. Each item is annotated with:
//   - source:    display label for the feed (title or hostname)
//   - thumbnail: best url we could find (media:thumbnail / enclosure / derived)
//   - videoId:   YouTube video id when the entry is a video (from yt:videoId)
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const feed_list = await prisma.feeds.findMany({
    where: { userId: user.id },
  });

  const feed_urls = feed_list.map((item: FeedLinks) => item.feed_url).slice(0, 100);

  const annotated: any[] = [];

  // Build items per feed in parallel; a dead feed must not sink the page.
  await Promise.all(
    feed_urls.map(async (url: string) => {
      try {
        const parser = new Parser({
          timeout: 20000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; neuralnexus/0.0; RSS)' },
          customFields: {
            item: [
              'media:thumbnail',
              'media:content',
              'enclosure',
              'yt:videoId',
            ],
          },
        });
        const feed = await parser.parseURL(url);
        const source = feedLabel(feed);
        const items = (feed.items || []).map((rawIt: any) => {
          const videoId =
            (rawIt['yt:videoId'] && String(rawIt['yt:videoId'])) || null;

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
              thumbnail = thumbnailFromAny(enc) || (typeof enc.url === 'string' ? enc.url : null);
            }
          }
          // YouTube video entries always have a thumbnail at this well-known
          // URL even when the feed nests it inside <media:group> (rss-parser
          // doesn't expose that to customFields).
          if (!thumbnail && videoId) {
            thumbnail = `https://i1.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }

          const out: Record<string, unknown> = {
            title: rawIt.title,
            link: rawIt.link,
            pubDate: rawIt.pubDate,
            categories: rawIt.categories,
            source,
            thumbnail,
            videoId,
          };
          return out;
        });
        annotated.push(...items);
      } catch {
        // Dead/unreachable feed — skip silently (existing behaviour).
      }
    })
  );

  const sorted_feed_items = annotated.sort((itemA, itemB) => {
    const pubDateA = itemA.pubDate ? new Date(itemA.pubDate) : new Date(0);
    const pubDateB = itemB.pubDate ? new Date(itemB.pubDate) : new Date(0);
    return pubDateB.getTime() - pubDateA.getTime();
  });

  return NextResponse.json(sorted_feed_items);
}
