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
    <KeyGate>
      {user && (
        <div className="bg-gray-400 p-4">
          <h1 className="text-2xl font-bold">Feeds</h1>
          <FeedUrlForm />
          <div className="pt-4">
            <p>Your feeds</p>
            {user && (
              <FeedList userId={user.id} />
            )}
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
    </>
  );
}
