import { FeedUrlForm } from "@/components/FeedPicker";
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/buttons';
import { authOptions } from "../../api/auth/[...nextauth]/route"
export default async function feedsPreference () {
  const session = await getServerSession(authOptions);

  const currentUserEmail = session?.user?.email!;
  const user = await prisma.user.findUnique({
    where: {
      email: currentUserEmail,
    }
  });

  return (
    <div>
      <h1 className='text-2xl font-bold'>Feeds</h1>
      <FeedUrlForm user={user} />
    </div>
  );
}