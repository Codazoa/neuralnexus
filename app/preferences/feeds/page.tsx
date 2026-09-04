import KeyGate from '@/components/KeyGate';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/key';
import { FeedDeleteForm, FeedUrlForm } from '@/components/FeedPicker';

interface FeedLinks {
  id: string;
  userId: string;
  feed_url: string;
  name: string | null;
  categories: string[];
}

// /preferences/feeds — manage the device's RSS feeds, behind the key gate.
export default async function FeedsPreference() {
  const user = await getCurrentUser();

  // Issue #35: the union of existing category names, offered as a dropdown
  // in the add-feed and edit-feed forms so the user can reuse a name instead
  // of retyping it.
  const existingCategories = user
    ? await prisma.category.findMany({
        where: { userId: user.id },
        select: { name: true },
        orderBy: { name: 'asc' },
      }).then((rows) => rows.map((r) => r.name))
    : [];

  return (
    <KeyGate withKeyBar={false}>
      {user && (
        <div>
          <h1 className="nn-text text-2xl font-bold tracking-tight">Feeds</h1>
          <p className="nn-mut mt-1 text-sm">
            Add, edit, or remove the RSS feeds that make up your
            everything feed.
          </p>

          <div className="mt-5">
            <FeedUrlForm existingCategories={existingCategories} />
          </div>

          <div className="mt-6">
            <h2 className="nn-mut text-sm font-semibold uppercase tracking-wide">
              Your feeds
            </h2>
            <div className="mt-3 space-y-2">
              {user && (
                <FeedList userId={user.id} existingCategories={existingCategories} />
              )}
            </div>
          </div>
        </div>
      )}
    </KeyGate>
  );
}

async function FeedList({
  userId,
  existingCategories,
}: {
  userId: string;
  existingCategories: string[];
}) {
  const feed_list = await prisma.feeds.findMany({
    where: { userId },
    include: {
      categories: {
        select: { category: { select: { name: true } } },
        orderBy: { categoryId: 'asc' },
      },
    },
  });
  const feeds = feed_list.map((f) => ({
    id: f.id,
    userId: f.userId,
    feed_url: f.feed_url,
    name: f.name,
    categories: f.categories.map((c) => c.category.name),
  }));
  return (
    <>
      {feeds.map((item: FeedLinks) => (
        <FeedDeleteForm
          item={item}
          existingCategories={existingCategories}
          key={item.id}
        />
      ))}
      {feeds.length === 0 && (
        <p className="nn-mut text-sm">No feeds yet.</p>
      )}
    </>
  );
}
