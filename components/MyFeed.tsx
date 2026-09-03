'use client';

import Feed from './Feed';
import { useEffect, useState } from 'react';

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
}

const PAGES_TO_SHOW = 10;
const ARTICLES_TO_GET = 100;

export default function MyFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Active category filter: null = "All" (everything), else an exact name.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const visible =
    activeCategory === null
      ? articles
      : articles.filter((a) =>
          (a.feedCategories || []).some(
            (n) => n.toLowerCase() === activeCategory!.toLowerCase()
          )
        );

  // Ceil (not floor) so a partial last page is reachable: with 11–19 items a
  // floor would collapse max_pages to 1 and leave items 11+ hidden behind a
  // disabled Next/Last. Clamp to 1 when empty.
  const max_pages = Math.max(
    1,
    Math.ceil(Math.min(ARTICLES_TO_GET, visible.length) / PAGES_TO_SHOW)
  );

  const changePage = (x: number) => {
    setPage((p) => Math.max(1, Math.min(max_pages, p + x)));
  };

  const selectCategory = (name: string | null) => {
    setActiveCategory(name);
    setPage(1);
  };

  const getArticles = async () => {
    try {
      const res = await fetch('/api/feeds/links', { method: 'GET' });
      if (res.status === 401) {
        setError('Locked — sign in again to view your feed.');
        setLoading(false);
        return;
      }
      const data = (await res.json()) as Article[];
      setArticles(data || []);
      setError(null);
    } catch {
      setError('Could not load your feed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getArticles();
  }, []);

  const pageButton =
    'nn-btn nn-btn-ghost !px-3.5 !py-2 disabled:cursor-not-allowed';

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
              (activeCategory === null ? 'nn-btn-active' : '')
            }
            onClick={() => selectCategory(null)}
            aria-pressed={activeCategory === null}
          >
            All
          </button>
          {categoryNames.map((name) => (
            <button
              key={name}
              className={
                'nn-btn nn-btn-ghost !px-3 !py-1.5 !text-xs ' +
                (activeCategory?.toLowerCase() === name.toLowerCase()
                  ? 'nn-btn-active'
                  : '')
              }
              onClick={() => selectCategory(name)}
              aria-pressed={activeCategory?.toLowerCase() === name.toLowerCase()}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}

          {!loading && visible.length === 0 && !error && (
            <p className="nn-surface-2 nn-border rounded-lg px-4 py-6 text-center text-sm">
              <span className="nn-mut">
                {activeCategory
                  ? `Nothing in “${activeCategory}” yet — add a feed to this category under Feeds.`
                  : 'No feeds yet — add one from the menu → Feeds.'}
              </span>
            </p>
          )}

          {visible
            .slice((page - 1) * PAGES_TO_SHOW, page * PAGES_TO_SHOW)
            .map((item, i) => (
              <Feed
                key={item.link || i}
                title={item.title || '(untitled)'}
                link={item.link || '#'}
                date={item.pubDate ? new Date(item.pubDate) : new Date(0)}
                source={item.source}
                thumbnail={item.thumbnail}
                videoId={item.videoId}
              />
            ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 sm:gap-3">
          <button className={pageButton} onClick={() => setPage(1)}>
            First
          </button>
          <button
            className={pageButton}
            onClick={() => changePage(-1)}
            disabled={page <= 1}
          >
            Prev
          </button>
          <span className="nn-text min-w-8 text-center text-2xl font-bold sm:text-3xl">
            {page}
          </span>
          <button
            className={pageButton}
            onClick={() => changePage(1)}
            disabled={page >= max_pages}
          >
            Next
          </button>
          <button className={pageButton} onClick={() => setPage(max_pages)}>
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
