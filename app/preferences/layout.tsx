import KeyGate from '@/components/KeyGate';
import Link from 'next/link';

// /preferences — gated admin area. Without an active session the user
// sees the unlock panel; with one, the sidebar + content render.
export default async function PreferencesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const menuItems = [
    { href: '/preferences/user', title: 'User' },
    { href: '/preferences/feeds', title: 'Feeds' },
    { href: '/preferences/settings', title: 'Settings' },
  ];

  return (
    <KeyGate withKeyBar={false}>
      <div className="flex">
        <aside className="w-full bg-gray-100 md:w-60 min-h-[70vh]">
          <nav>
            <ul>
              {menuItems.map(({ href, title }) => (
                <li className="m-2" key={title}>
                  <Link
                    href={href}
                    className="flex p-2 bg-orange-100 rounded hover:bg-orange-500 cursor-pointer"
                  >
                    {title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="flex-auto">{children}</main>
      </div>
    </KeyGate>
  );
}
