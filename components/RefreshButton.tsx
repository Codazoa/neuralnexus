'use client';

import { usePathname, useRouter } from 'next/navigation';

/**
 * Top-nav "Refresh feeds" button (issue #25).
 *
 * It re-fetches the user's subscribed feeds so a feed that failed to load on
 * the first pull (a transient upstream timeout is the usual culprit) can be
 * retried without the user reloading the whole page.
 *
 * How the button reaches the feed:
 *  - If we're already on /myfeed we just broadcast a window event — the mounted
 *    MyFeed listens for it and re-fetches in place (no remount, category +
 *    page are preserved).
 *  - Anywhere else we broadcast the same event AND navigate to /myfeed, where
 *    the freshly-mounted MyFeed picks up the event (and, if we missed it,
 *    fetches on mount) and shows the latest items.
 *
 * The event is a no-op on pages that don't render MyFeed, so this is safe to
 * mount globally in the nav bar.
 */
export const REFRESH_EVENTS = [
  'neuralnexus:refresh-feeds',
  'nnx:refresh',
];

export function emitRefresh() {
  if (typeof window === 'undefined') return;
  for (const name of REFRESH_EVENTS) {
    window.dispatchEvent(new Event(name));
  }
}

export default function RefreshButton() {
  const pathname = usePathname();
  const router = useRouter();

  const onRefresh = () => {
    emitRefresh();
    // Already on the feed — the event above re-fetches in place.
    if (pathname && pathname.startsWith('/myfeed')) return;
    // Coming from another page: go to the feed and hand it a fresh pull.
    router.push('/myfeed');
  };

  return (
    <button
      type="button"
      onClick={onRefresh}
      aria-label="Refresh feeds"
      title="Refresh feeds"
      className="nn-btn nn-btn-ghost !px-2.5 !py-2 text-base leading-none"
    >
      {/* Circular "refresh" / reload icon (two arcs with arrowheads). */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v5h-5" />
      </svg>
    </button>
  );
}
