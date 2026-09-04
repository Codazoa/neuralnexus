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
      <div className="nn-bg mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:flex-row sm:py-8">
        <aside className="nn-surface-2 nn-border w-full rounded-xl border p-2 sm:w-56">
          <nav className="space-y-1" aria-label="Preferences">
            {menuItems.map(({ href, title }) => (
              <Link
                key={title}
                href={href}
                className="nn-link block rounded-lg px-3 py-2.5 text-sm font-medium"
              >
                {title}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </KeyGate>
  );
}
