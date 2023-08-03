import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from "../../auth/[...nextauth]/route"
import Parser from 'rss-parser';

interface FeedLinks {
  id: string;
  userId: string;
  feed_url: string;
}

export async function GET(req: Request) {
  // user validation
  const session = await getServerSession(authOptions);
  const currentUserEmail = session?.user?.email!;

  const user = await prisma.user.findUnique({
    where: {email: currentUserEmail}
  });

  if (!user) {
    return NextResponse.json({error: 'No user found'}, { status: 404})
  }

  // setting up rss parser
  const parser = new Parser();

  // grabbing all the feeds the user has subscribed to
  const feed_list = await prisma.feeds.findMany({
    where: {
      userId: user.id
    }
  });

  // list of just the urls the user has subscribed to
  const feed_urls_all = feed_list.map((item: FeedLinks ) => item.feed_url);
  const feed_urls = feed_urls_all.slice(0,100);

  // get the feed items for a single link
  const get_feed_items = async (feed_url: string) => {
    return await parser.parseURL(feed_url);
  }

  // go though all the links and append their items to feed_items
  const feed_items = await Promise.all(feed_urls.map(async (url: string) => {
    const items = await get_feed_items(url);
    return items.items; // Assuming that items is an object with an 'items' property
  })).then((resultArrays) => resultArrays.flatMap((items) => items));
  
  const sorted_feed_items = feed_items.sort((itemA, itemB) => {
    const pubDateA = itemA.pubDate ? new Date(itemA.pubDate) : new Date(0); // Default to epoch if undefined
    const pubDateB = itemB.pubDate ? new Date(itemB.pubDate) : new Date(0); // Default to epoch if undefined
  
    return pubDateB.getTime() - pubDateA.getTime(); // Sort in descending order (newest first)
  });

  return NextResponse.json(sorted_feed_items);
}