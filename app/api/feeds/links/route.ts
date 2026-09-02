import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/key';
import Parser from 'rss-parser';

interface FeedLinks {
  id: string;
  userId: string;
  feed_url: string;
}

// GET /api/feeds/links
// Fetch the user's subscribed feeds and aggregate the latest items,
// sorted newest-first.
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const parser = new Parser();

  const feed_list = await prisma.feeds.findMany({
    where: { userId: user.id },
  });

  const feed_urls = feed_list.map((item: FeedLinks) => item.feed_url).slice(0, 100);

  const get_feed_items = async (feed_url: string) => parser.parseURL(feed_url);

  const feed_items: any[] = await Promise.all(
    feed_urls.map(async (url: string): Promise<any[]> => {
      try {
        const items = await get_feed_items(url);
        return items.items;
      } catch {
        // A dead/unreachable feed shouldn't sink the whole page.
        return [];
      }
    })
  ).then((resultArrays) => resultArrays.flatMap((chunk) => chunk));

  const sorted_feed_items = feed_items.sort((itemA: any, itemB: any) => {
    const pubDateA = itemA.pubDate ? new Date(itemA.pubDate) : new Date(0);
    const pubDateB = itemB.pubDate ? new Date(itemB.pubDate) : new Date(0);
    return pubDateB.getTime() - pubDateA.getTime();
  });

  return NextResponse.json(sorted_feed_items);
}
