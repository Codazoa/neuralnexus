import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '../api/auth/[...nextauth]/route';
import Link from 'next/link';
import React from 'react';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/api/auth/signin');
  }

  const menuItems = [
    { href: '/preferences/user', title: 'User' },
    { href: '/preferences/feeds', title: 'Feeds' },
    { href: '/preferences/settings', title: 'Settings' },
  ];

  return (
    <div className='flex'>
        <aside className='w-full bg-gray-100 md:w-60 min-h-screen'>
          <nav>
            <ul>
              {menuItems.map(({ href, title }) => (
                <li className='m-2' key={title}>
                  <Link href={href} className={`flex p-2 bg-orange-100 rounded hover:bg-orange-500 cursor-pointer`}>{title}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      <main className='flex-auto'>{children}</main>
    </div>
  );
}