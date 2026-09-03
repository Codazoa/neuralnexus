'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FeedUrlForm({ user }: any) {
  const router = useRouter();
  const [categories, setCategories] = useState('');

  const addFeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const body = {
      url: formData.get('feed url'),
      categories: categories.trim() || undefined,
    };

    const res = await fetch('/api/feeds', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json'
      },
    });

    if (res.ok) {
      setCategories('');
    }
    router.refresh();
  };

  return (
    <div className="nn-surface nn-border rounded-xl p-4 sm:p-5">
      <h2 className="nn-text text-lg font-semibold">Add a feed</h2>
      <p className="nn-mut mt-1 text-xs">
        Paste an RSS/Atom feed URL — or a YouTube channel link (e.g.
        <span className="nn-mut"> youtube.com/@handle</span>) and we&apos;ll find its feed.
      </p>
      <form onSubmit={addFeed} className="mt-3 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="nn-input order-2 sm:order-1 sm:flex-1"
            type="text"
            name="feed url"
            defaultValue="https://example.com/feed.rss"
            placeholder="https://example.com/feed.rss  or  https://www.youtube.com/@YourChannel"
            aria-label="Feed URL"
          />
          <button className="nn-btn nn-btn-primary order-1 sm:order-2" type="submit">
            Add Feed
          </button>
        </div>
        <input
          className="nn-input"
          type="text"
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          placeholder="Categories (optional) — e.g. tech, gaming"
          aria-label="Categories"
        />
        <p className="nn-mut text-[11px]">
          Optional. Separate several categories with commas to file this feed
          under more than one.
        </p>
      </form>
    </div>
  );
}

export function FeedDeleteForm({ item }: any) {
  const router = useRouter();

  const delFeed = async () => {
    await fetch(`/api/feeds?feedId=${item.id}`, {
      method: 'DELETE'
    });

    router.refresh();
  };

  return (
    <div className="nn-surface nn-border flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
      <p className="nn-mut min-w-0 flex-1 truncate text-sm">{item.feed_url}</p>
      <button
        className="nn-btn nn-btn-ghost shrink-0 !px-3 !py-1.5 !text-xs"
        onClick={delFeed}
      >
        Delete
      </button>
    </div>
  );
}
