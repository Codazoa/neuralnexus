import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/key';
import { isYouTubeChannelUrl, resolveYouTubeFeed } from '@/lib/youtube';

// PUT /api/feeds  — add a new RSS feed for the (sole local) user.
// NOTE: method stays PUT to match the existing client-side form.
//
// If the entered url is a YouTube channel, we resolve it to the channel's native
// RSS feed (https://www.youtube.com/feeds/videos.xml?channel_id=UC...) and store the
// *feed* url rather than the youtube url the user typed (issue #13). Any youtube url
// we can't positively resolve to a channel is stored as-is, unchanged.
export async function PUT(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let data: { url?: string } = {};
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const enteredUrl = (data.url || '').trim();
  if (!enteredUrl) {
    return NextResponse.json({ error: 'Feed url is required' }, { status: 400 });
  }

  // YouTube channel -> canonical RSS feed url. Falls back to the entered url on
  // failure so a bad/unknown link still behaves exactly like it did before.
  let feedUrl = enteredUrl;
  let resolved: boolean;
  if (isYouTubeChannelUrl(enteredUrl)) {
    const converted = await resolveYouTubeFeed(enteredUrl);
    if (converted) {
      feedUrl = converted;
      resolved = true;
    } else {
      resolved = false;
    }
  } else {
    resolved = false;
  }

  const existing = await prisma.feeds.findFirst({
    where: { userId: user.id, feed_url: feedUrl },
  });
  if (existing) {
    const message = resolved
      ? 'This channel is already subscribed'
      : 'Duplicate feed url';
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const feed = await prisma.feeds.create({
    data: { userId: user.id, feed_url: feedUrl },
  });

  const body: Record<string, unknown> = { ...feed, resolved };
  if (resolved) body.resolved_from = enteredUrl;
  return NextResponse.json(body, { status: 201 });
}

// GET /api/feeds  — list the user's feeds.
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const feeds = await prisma.feeds.findMany({ where: { userId: user.id } });
  return NextResponse.json(feeds);
}

// DELETE /api/feeds?feedId=...  — remove a feed.
export async function DELETE(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const feedId = request.nextUrl.searchParams.get('feedId');
  if (!feedId) {
    return NextResponse.json({ error: 'feedId query param is required' }, { status: 400 });
  }

  // Only the owner can delete their own feed.
  const deleted = await prisma.feeds.deleteMany({
    where: { id: feedId, userId: user.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
