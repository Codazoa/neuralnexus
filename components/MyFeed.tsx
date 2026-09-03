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
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());

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

  // Issue #34: one continuous scroll — no pagination / page buttons.

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
  };

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

          {visible.map((item, i) => (
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
      </div>
    </div>
  );
}
