import { FeedDeleteForm, FeedUrlForm } from "@/components/FeedPicker";
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from "../../api/auth/[...nextauth]/route"

interface FeedLinks {
  id: string;
  userId: string;
  feed_url: string;
}

export default async function feedsPreference () {
  const session = await getServerSession(authOptions);

  const currentUserEmail = session?.user?.email!;
  const user = await prisma.user.findUnique({
    where: {
      email: currentUserEmail,
    }
  });

  const feed_list_promise = prisma.feeds.findMany({
    where: {
      userId: user?.id
    }
  });

  const feed_list = await feed_list_promise;

  return (
    <div className='bg-gray-400 p-4'>
      <h1 className='text-2xl font-bold'>Feeds</h1>
      <FeedUrlForm user={user} />
      <div className='pt-4'>
        <p>Your feeds</p>
        {feed_list.map((item: FeedLinks, i: number) =>
          <FeedDeleteForm item={item}/>
        )}
      </div>
    </div>
  );
}