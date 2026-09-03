import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/key';
import { isYouTubeChannelUrl, resolveYouTubeFeed } from '@/lib/youtube';

interface CategoryNameInput {
  name: string;
}

// Normalise user-entered category names (comma/"and" separated, trimmed,
// de-duped case-insensitively). Empty -> null (no categories).
function normalizeCategories(raw?: string): string[] | null {
  if (!raw) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/,|;|\band\b/gi)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.length ? out : null;
}

// PUT /api/feeds  — add a new RSS feed for the (sole local) user.
// NOTE: method stays PUT to match the existing client-side form.
//
// If the entered url is a YouTube channel, we resolve it to the channel's native
// RSS feed (https://www.youtube.com/feeds/videos.xml?channel_id=UC...) and store the
// *feed* url rather than the youtube url the user typed (issue #13). Any youtube url
// we can't positively resolve to a channel is stored as-is, unchanged.
//
// Optional `categories` (string, e.g. "tech, gaming") assigns the feed to
// multiple existing (or newly created) categories (issue #20).
export async function PUT(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let data: { url?: string; categories?: string } = {};
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const enteredUrl = (data.url || '').trim();
  if (!enteredUrl) {
    return NextResponse.json({ error: 'Feed url is required' }, { status: 400 });
  }
  const names = normalizeCategories(data.categories);

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

  let created: {
    id: string;
    userId: string;
    feed_url: string;
  } | null = null;
  let categories: CategoryNameInput[] = [];

  await prisma.$transaction(async (tx) => {
    const row = await tx.feeds.create({
      data: { userId: user.id, feed_url: feedUrl },
    });
    created = { id: row.id, userId: row.userId, feed_url: row.feed_url };

    if (names) {
      for (const name of names) {
        const cat = await tx.category.upsert({
          where: { userId_name: { userId: user.id, name } },
          create: { name, userId: user.id },
          update: {},
        });
        await tx.feedCategory.upsert({
          where: { feedId_categoryId: { feedId: row.id, categoryId: cat.id } },
          create: { feedId: row.id, categoryId: cat.id },
          update: {},
        });
        categories.push({ name });
      }
    }
  });

  const finalFeed = created!;
  const body: Record<string, unknown> = { ...finalFeed, resolved, categories };
  if (resolved) body.resolved_from = enteredUrl;
  return NextResponse.json(body, { status: 201 });
}

// GET /api/feeds  — list the user's feeds (with their category names).
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const feeds = await prisma.feeds.findMany({
    where: { userId: user.id },
    include: {
      categories: {
        select: { category: { select: { name: true } } },
        orderBy: { categoryId: 'asc' },
      },
    },
  });
  const out = feeds.map((f) => ({
    ...f,
    categories: f.categories.map((c) => c.category.name),
  }));
  return NextResponse.json(out);
}

// PATCH /api/feeds  — update a feed's categories (issue #23).
// Body: { feedId: string, categories?: string } — `categories` uses the same
// normalisation as PUT (comma/";"/"and" separated, deduped case-insensitively).
// An empty/omitted categories value clears all categories on the feed.
export async function PATCH(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let data: { feedId?: string; categories?: string } = {};
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const feedId = (data.feedId || '').trim();
  if (!feedId) {
    return NextResponse.json({ error: 'feedId is required' }, { status: 400 });
  }

  // Only the owner's feed can be modified.
  const feed = await prisma.feeds.findFirst({
    where: { id: feedId, userId: user.id },
  });
  if (!feed) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
  }

  const names = normalizeCategories(data.categories);

  await prisma.$transaction(async (tx) => {
    // Replace the feed's category assignments wholesale.
    await tx.feedCategory.deleteMany({ where: { feedId } });
    if (names) {
      for (const name of names) {
        const cat = await tx.category.upsert({
          where: { userId_name: { userId: user.id, name } },
          create: { name, userId: user.id },
          update: {},
        });
        await tx.feedCategory.upsert({
          where: { feedId_categoryId: { feedId, categoryId: cat.id } },
          create: { feedId, categoryId: cat.id },
          update: {},
        });
      }
    }
  });

  const updated = await prisma.feeds.findFirst({
    where: { id: feedId },
    include: { categories: { select: { category: { select: { name: true } } }, orderBy: { categoryId: 'asc' } } },
  });
  return NextResponse.json({
    id: updated!.id,
    feed_url: updated!.feed_url,
    categories: updated!.categories.map((c) => c.category.name),
  });
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
