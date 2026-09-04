'use client';

import Feed from './Feed';
import { REFRESH_EVENTS } from './RefreshButton';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Article {
  title?: string;
  link?: string;
  pubDate?: string;
  /** Display label for where this item came from (feed title or hostname). */
  source?: string | null;
  /** Image above the title (articles) — or the card visual for video feeds. */
  thumbnail?: string | null;
  /** YouTube video id (when present shows an embedded player below the title). */
  videoId?: string | null;
  /** Names of the categories this item's feed was filed under (issue #20). */
  feedCategories?: string[] | null;
  /** HTML content of the entry, shown when the card expands (issue #33). */
  content?: string | null;
}

// Pagination caps (issue #38): rendering the full feed at once (the #34
// "continuous scroll" change) loads every thumbnail image + every embedded
// YouTube iframe simultaneously, which overflows iOS WebKit's memory budget
// and crash-kills the page ("A problem repeatedly occurred on …"). Cap the
// mounted DOM again: 10 articles per page, 100 articles reachable in total.
const PAGES_TO_SHOW = 10;
const ARTICLES_TO_GET = 100;

/** A feed the server tried to load this cycle but couldn't (issue #25). */
interface FailedFeed {
  label: string;
  url: string;
  error?: string;
}

/**
 * Response shape of GET /api/feeds/links (issue #25). Old responses (bare
 * arrays) are normalised in `getArticles` for safety.
 */
interface FeedLinksPayload {
  items: Article[];
  failedFeeds?: FailedFeed[];
}

// Issue #42: the user's selected category filter survives across sessions.
// Stored as a JSON array of lower-cased category names in localStorage, keyed
// per browser (this is a single-user local app, so per-browser is the right
// scope — no server round trip, and it works offline).
const CATEGORIES_STORAGE_KEY = 'nn.myfeed.categories.v1';

function readStoredCategories(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(
        parsed
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.toLowerCase())
      );
    }
  } catch {
    // Corrupt / unavailable storage — fall back to "All".
  }
  return new Set();
}

export default function MyFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [failedFeeds, setFailedFeeds] = useState<FailedFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ref guard to ignore a second Refresh click while the first fetch is
  // still in flight (setState hasn't landed by the time the closure was
  // captured — so we don't rely on the `loading` state here).
  const inFlight = useRef(false);
  // Active category filter (issue #36): a SET of names, not one. Empty set =
  // "All" (everything). Toggle as many categories as you like — an item
  // shows if it matches ANY of them (OR semantics), e.g. tech + gaming shows
  // both and still hides politics.
  // Issue #42: seeded from localStorage so the user's last selection
  // survives across sessions (lazy init keeps this client-only).
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => readStoredCategories()
  );
  // Page index (issue #38): restored from #34's removal — see PAGES_TO_SHOW.
  const [page, setPage] = useState(1);

  // Union of category names across loaded feeds (case-insensitively unique,
  // insertion order preserved — the order feeds were added in).
  const categoryNames: string[] = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of articles) {
      for (const name of (a.feedCategories || [])) {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(name);
        }
      }
    }
    return out;
  })();

  // Issue #36: multiple selected categories at once (OR semantics) — an
  // item shows if it matches ANY of the selected names.
  const visible =
    activeCategories.size === 0
      ? articles
      : articles.filter((a) =>
          (a.feedCategories || []).some((n) =>
            activeCategories.has(n.toLowerCase())
          )
        );

  // Issue #38: pagination restored (10 per page, capped at ARTICLES_TO_GET).
  // `visible` is filtered by the active categories; clamp the page we render
  // to what actually exists so a stale page index never shows an empty list.
  const max_pages = Math.max(
    1,
    Math.ceil(Math.min(ARTICLES_TO_GET, visible.length) / PAGES_TO_SHOW)
  );
  const safePage = Math.max(1, Math.min(page, max_pages));
  const changePage = (delta: number) =>
    setPage((p) => Math.max(1, Math.min(max_pages, p + delta)));
  const changePageTo = (target: number) =>
    setPage(Math.max(1, Math.min(max_pages, target)));

  const toggleCategory = (name: string | null) => {
    const next = new Set(activeCategories);
    if (name === null) {
      // "All" clears the selection.
      next.clear();
    } else {
      const key = name.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
    }
    setActiveCategories(next);
    // A category toggle changes which items are visible — jump back to the
    // first page so we don't land on a now-empty page (issue #38).
    setPage(1);
  };

  const pageButton =
    'nn-btn nn-btn-ghost !px-3.5 !py-2 disabled:cursor-not-allowed';

  // Shared pagination controls (issue #38). Rendered at the BOTTOM of the
  // list and (when more than one page exists) at the TOP (issue #40) so
  // page switching works without scrolling. 10 per page, max
  // ARTICLES_TO_GET reachable — caps the mounted DOM so /myfeed does not
  // overflow iOS WebKit's memory budget and crash out a few seconds after
  // load (the #34 "continuous scroll" regression).
  const renderPagination = () => (
    <div className="mt-8 flex items-center justify-center gap-2 sm:gap-3">
      <button className={pageButton} onClick={() => changePageTo(1)} disabled={safePage <= 1}>
        First
      </button>
      <button className={pageButton} onClick={() => changePage(-1)} disabled={safePage <= 1}>
        Prev
      </button>
      <span className="nn-text min-w-8 text-center text-2xl font-bold sm:text-3xl">
        {safePage}
      </span>
      <button className={pageButton} onClick={() => changePage(1)} disabled={safePage >= max_pages}>
        Next
      </button>
      <button className={pageButton} onClick={() => changePageTo(max_pages)} disabled={safePage >= max_pages}>
        Last
      </button>
    </div>
  );

  const getArticles = useCallback(async () => {
    if (inFlight.current) return; // ignore a second Refresh while already fetching
    inFlight.current = true;
    setLoading(true); // keep the "loading…" indicator visible during a manual refresh
    try {
      const res = await fetch('/api/feeds/links', { method: 'GET' });
      if (res.status === 401) {
        setError('Locked — sign in again to view your feed.');
        return;
      }
      const data = (await res.json()) as unknown;
      // Normalise: the API returns { items, failedFeeds } (issue #25), but
      // tolerate a legacy bare-array response.
      const items: Article[] = Array.isArray(data)
        ? (data as Article[])
        : ((data as FeedLinksPayload)?.items || []);
      const failed = Array.isArray(data)
        ? []
        : ((data as FeedLinksPayload)?.failedFeeds || []);
      setArticles(items);
      setFailedFeeds(failed);
      setError(null);
    } catch {
      setError('Could not load your feed.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  // Issue #42: persist the selected category set across sessions. Runs on
  // every change to `activeCategories` (and once on mount to seed a
  // clean "All" if the user has never toggled anything).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        CATEGORIES_STORAGE_KEY,
        JSON.stringify(Array.from(activeCategories))
      );
    } catch {
      // Storage unavailable (private mode / quota) — ignore, the filter
      // still works in-session.
    }
  }, [activeCategories]);

  // Initial fetch.
  useEffect(() => {
    getArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when the top-nav Refresh button fires a request (issue #25).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => getArticles();
    for (const name of REFRESH_EVENTS) window.addEventListener(name, handler);
    return () => {
      for (const name of REFRESH_EVENTS) window.removeEventListener(name, handler);
    };
  }, [getArticles]);

  return (
    <div className="nn-bg min-h-[70vh]">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="nn-mut flex items-baseline justify-between">
          <h1 className="nn-text text-2xl font-bold tracking-tight sm:text-3xl">
            My Feed
          </h1>
          {loading && <span className="text-sm">loading…</span>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className={
              'nn-btn nn-btn-ghost !px-3 !py-1.5 !text-xs ' +
              (activeCategories.size === 0 ? 'nn-btn-active' : '')
            }
            onClick={() => toggleCategory(null)}
            aria-pressed={activeCategories.size === 0}
          >
            All
          </button>
          {categoryNames.map((name) => (
            <button
              key={name}
              className={
                'nn-btn nn-btn-ghost !px-3 !py-1.5 !text-xs ' +
                (activeCategories.has(name.toLowerCase())
                  ? 'nn-btn-active'
                  : '')
              }
              onClick={() => toggleCategory(name)}
              aria-pressed={activeCategories.has(name.toLowerCase())}
            >
              {name}
            </button>
          ))}
        </div>
        {activeCategories.size > 1 && (
          <p className="nn-mut mt-1.5 text-xs">
            Showing feeds in {activeCategories.size} selected categories —
            pick another to add it, or hit “All” to clear.
          </p>
        )}

        {/* Feeds that didn't load on this cycle (issue #25): the user can
             press the Refresh button above to retry — the server also
             automatically retries once before reporting a feed as failed. */}
        {!loading && failedFeeds.length > 0 && (
          <div className="mt-4 rounded-lg border amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {failedFeeds.length === 1
                ? '1 feed didn’t load this time'
                : `${failedFeeds.length} feeds didn’t load this time`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {failedFeeds.slice(0, 3).map((f, i) => (
                <li key={i} className="truncate text-amber-700 dark:text-amber-300">
                  <span className="font-mono">{f.label}</span>
                  {f.error && (
                    <span className="ml-2 opacity-75">
                      — {f.error.length > 60 ? f.error.slice(0, 60) + '…' : f.error}
                    </span>
                  )}
                </li>
              ))}
              {failedFeeds.length > 3 && (
                <li className="text-amber-700/70 dark:text-amber-300/70">
                  +{failedFeeds.length - 3} more
                </li>
              )}
            </ul>
            <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
              Use the <span className="font-medium">Refresh</span> button in the top nav to try again.
            </p>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {/* Top pagination (issue #40): same First/Prev/Next/Last controls as
               the bottom, for quick page switching without scrolling. Only
               shown when more than one page exists. */}
          {max_pages > 1 && (
            <div className="mb-0 sm:mb-1 [&>div]:mt-0">{renderPagination()}</div>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}

          {!loading && visible.length === 0 && !error && (
            <p className="nn-surface-2 nn-border rounded-lg px-4 py-6 text-center text-sm">
              <span className="nn-mut">
                {activeCategories.size > 0
                  ? 'Nothing in the selected categories yet — add a feed to one of them under Feeds, or pick a different category.'
                  : 'No feeds yet — add one from the menu → Feeds.'}
              </span>
            </p>
          )}

          {visible.slice((safePage - 1) * PAGES_TO_SHOW, safePage * PAGES_TO_SHOW).map((item, i) => (
            <Feed
              key={item.link || i}
              title={item.title || '(untitled)'}
              link={item.link || '#'}
              date={item.pubDate ? new Date(item.pubDate) : new Date(0)}
              source={item.source}
              thumbnail={item.thumbnail}
              videoId={item.videoId}
              content={item.content}
            />
          ))}
        </div>

        {/* Bottom pagination (issue #38): caps the mounted DOM so /myfeed
             does not overflow iOS WebKit's memory budget and crash out a
             few seconds after load. 10 per page, max ARTICLES_TO_GET
             reachable. The #34 "continuous scroll" change removed these
             controls — that was the regression this issue reports.
             Mirrored at the top of the list for issue #40. */}
        <div className="[&>div]:mt-8">{renderPagination()}</div>
      </div>
    </div>
  );
}
