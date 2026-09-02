import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/key';

// PUT /api/feeds  — add a new RSS feed for the (sole local) user.
// NOTE: method stays PUT to match the existing client-side form.
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

  const feedUrl = (data.url || '').trim();
  if (!feedUrl) {
    return NextResponse.json({ error: 'Feed url is required' }, { status: 400 });
  }

  const existing = await prisma.feeds.findFirst({
    where: { userId: user.id, feed_url: feedUrl },
  });
  if (existing) {
    return NextResponse.json({ error: 'Duplicate feed url' }, { status: 409 });
  }

  const feed = await prisma.feeds.create({
    data: { userId: user.id, feed_url: feedUrl },
  });
  return NextResponse.json(feed, { status: 201 });
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
