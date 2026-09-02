import KeyGate from '@/components/KeyGate';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/key';
import { FeedDeleteForm, FeedUrlForm } from '@/components/FeedPicker';

interface FeedLinks {
  id: string;
  userId: string;
  feed_url: string;
}

// /preferences/feeds — manage the device's RSS feeds, behind the key gate.
export default async function FeedsPreference() {
  const user = await getCurrentUser();

  return (
    <KeyGate withKeyBar={false}>
      {user && (
        <div>
          <h1 className="nn-text text-2xl font-bold tracking-tight">Feeds</h1>
          <p className="nn-mut mt-1 text-sm">
            Add or remove the RSS feeds that make up your everything feed.
          </p>

          <div className="mt-5">
            <FeedUrlForm />
          </div>

          <div className="mt-6">
            <h2 className="nn-mut text-sm font-semibold uppercase tracking-wide">
              Your feeds
            </h2>
            <div className="mt-3 space-y-2">
              {user && <FeedList userId={user.id} />}
            </div>
          </div>
        </div>
      )}
    </KeyGate>
  );
}

async function FeedList({ userId }: { userId: string }) {
  const feed_list = await prisma.feeds.findMany({ where: { userId } });
  return (
    <>
      {feed_list.map((item: FeedLinks) => (
        <FeedDeleteForm item={item} key={item.id} />
      ))}
      {feed_list.length === 0 && (
        <p className="nn-mut text-sm">No feeds yet.</p>
      )}
    </>
  );
}
