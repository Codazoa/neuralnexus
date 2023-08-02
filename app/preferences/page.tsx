import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '../api/auth/[...nextauth]/route';

export default async function Preferences() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/api/auth/signin');
  }

  return (
    <div>
      <p>Preferences</p>
    </div>
  );
}