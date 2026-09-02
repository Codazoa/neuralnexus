'use client';

import Feed from './Feed';
import { useEffect, useState } from 'react';

interface Article {
  title?: string;
  link?: string;
  pubDate?: string;
}

const PAGES_TO_SHOW = 10;
const ARTICLES_TO_GET = 100;

export default function MyFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const max_pages = Math.max(
    1,
    Math.floor(Math.min(ARTICLES_TO_GET, articles.length) / PAGES_TO_SHOW)
  );

  const changePage = (x: number) => {
    setPage((p) => Math.max(1, Math.min(max_pages, p + x)));
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
  };

  useEffect(() => {
    getArticles();
  }, []);

  return (
    <div className="bg-gray-600">
      <div className="mx-auto max-w-3xl my-8 overflow-y-scroll bg-gray-900 px-2 py-6">
        <div className="flex items-baseline justify-between px-2">
          <h1 className="text-2xl font-bold text-white">My Feed</h1>
          {loading && <span className="text-sm text-gray-400">loading…</span>}
        </div>

        {error && <p className="mt-4 px-2 text-red-300">{error}</p>}

        {!loading && articles.length === 0 && !error && (
          <p className="mt-4 px-2 text-gray-400">
            No feeds yet — add one from the menu → Feeds.
          </p>
        )}

        {articles
          .slice((page - 1) * PAGES_TO_SHOW, page * PAGES_TO_SHOW)
          .map((item, i) => (
            <div className="pb-1" key={item.link || i}>
              <Feed
                key={i}
                title={item.title || '(untitled)'}
                link={item.link || '#'}
                date={item.pubDate ? new Date(item.pubDate) : new Date(0)}
              />
            </div>
          ))}
      </div>

      <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 py-6">
        <button
          className="bg-orange-600 rounded px-4 py-2 text-white hover:bg-orange-700"
          onClick={() => setPage(1)}
        >
          First
        </button>
        <button
          className="bg-orange-600 rounded px-4 py-2 text-white hover:bg-orange-700"
          onClick={() => changePage(-1)}
        >
          Prev
        </button>
        <h3 className="text-3xl font-bold text-white">{page}</h3>
        <button
          className="bg-orange-600 rounded px-4 py-2 text-white hover:bg-orange-700"
          onClick={() => changePage(1)}
        >
          Next
        </button>
        <button
          className="bg-orange-600 rounded px-4 py-2 text-white hover:bg-orange-700"
          onClick={() => setPage(max_pages)}
        >
          Last
        </button>
      </div>
    </div>
  );
}
