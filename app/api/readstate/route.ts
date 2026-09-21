import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/key';

// /api/readstate — read/unread state for feed items (issue #60, ADR-002).
//
// Storage is the local cache DB only: read-state is convenience metadata,
// not authored content. Deleting the backend loses read-state, nothing else;
// pod-backed read-state is a P2/M4 concern (PLAN.md §3 P2, §6 M4).
//
//   GET  /api/readstate            -> { itemIds: string[] }
//   PUT  /api/readstate            body { itemId, read: boolean } -> { itemIds }
//   POST /api/readstate            -> mark ALL cached items read -> { itemIds }
//
// `itemId` is the stable feed-scoped id from the links route
// (`<feedId>::<link|guid|title>`), so it is safe as a plain-text key and
// namespaced per feed.

/** Load the user's set of read item ids, newest-first is irrelevant — order
 *  is stable enough for a Set / dedup; callers only do membership tests. */
async function readSet(userId: string): Promise<Set<string>> {
  const rows = await prisma.readState.findMany({
    where: { userId },
    select: { itemId: true },
  });
  return new Set(rows.map((r) => r.itemId));
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const itemIds = Array.from(await readSet(user.id));
  return NextResponse.json({ itemIds });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { itemId?: unknown; read?: unknown }
    | null;
  const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
  const read = body?.read === true;
  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
  }
  // Defensive cap: item ids are feed-scoped strings, keep them bounded.
  if (itemId.length > 1024) {
    return NextResponse.json({ error: 'itemId too long' }, { status: 400 });
  }

  if (read) {
    await prisma.readState.upsert({
      where: { userId_itemId: { userId: user.id, itemId } },
      create: { userId: user.id, itemId, readAt: new Date() },
      update: { readAt: new Date() },
    });
  } else {
    await prisma.readState.deleteMany({
      where: { userId: user.id, itemId },
    });
  }

  const itemIds = Array.from(await readSet(user.id));
  return NextResponse.json({ itemIds });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Mark every item we can see in the cache as read. We enumerate the cached
  // items (not the ReadState table) so this works even for items the user has
  // never opened. Bounded by the same 100-feed cap the links route uses.
  //
  // Items cached before the read-state PR have no `id` field (the links route
  // falls back to a derived id for those, see `itemId` in links/route.ts) —
  // derive the identical id here so a "mark all read" covers them too. The
  // formula (feed-scoped link|guid|title) must stay in sync with both.
  const readstateItemId = (feedId: string, it: any): string | null => {
    const link = typeof it?.link === 'string' && it.link.trim() ? it.link.trim() : undefined;
    const guid = typeof it?.guid === 'string' && it.guid.trim() ? it.guid.trim() : undefined;
    const title = typeof it?.title === 'string' ? it.title.trim().slice(0, 120) : '';
    const stem = link || guid || title || 'item';
    return stem ? `${feedId}::${stem}` : null;
  };
  const feed_list = await prisma.feeds.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const feedIds = feed_list.slice(0, 100).map((f) => f.id);

  let marked = 0;
  if (feedIds.length > 0) {
    const rows = await prisma.feedCache.findMany({
      where: { userId: user.id, feedId: { in: feedIds } },
      select: { items: true, feedId: true },
    });
    const toInsert = new Map<string, Date>(); // dedupe by itemId
    for (const row of rows) {
      let arr: unknown;
      try {
        arr = JSON.parse(row.items);
      } catch {
        continue;
      }
      if (!Array.isArray(arr)) continue;
      for (const it of arr) {
        const rawId = (it as { id?: unknown })?.id;
        const itemId =
          typeof rawId === 'string' && rawId.trim()
            ? rawId.trim()
            : readstateItemId(row.feedId, it);
        if (!itemId || itemId.length > 1024) continue;
        if (!toInsert.has(itemId)) toInsert.set(itemId, new Date());
      }
    }
    const entries = Array.from(toInsert.entries());
    // Chunk the upserts to keep individual transactions small.
    const CHUNK = 500;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const slice = entries.slice(i, i + CHUNK);
      await prisma.$transaction(
        slice.map(([itemId, readAt]) =>
          prisma.readState.upsert({
            where: { userId_itemId: { userId: user.id, itemId } },
            create: { userId: user.id, itemId, readAt },
            update: { readAt },
          })
        )
      );
      marked += slice.length;
    }
  }

  const itemIds = Array.from(await readSet(user.id));
  return NextResponse.json({ itemIds, marked });
}
