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
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState((item.categories || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delFeed = async () => {
    await fetch(`/api/feeds?feedId=${item.id}`, {
      method: 'DELETE'
    });

    router.refresh();
  };

  const saveCategories = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch('/api/feeds', {
      method: 'PATCH',
      body: JSON.stringify({ feedId: item.id, categories }),
      headers: { 'Content-Type': 'application/json' },
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      let message = 'Could not update the feed';
      try {
        const data = await res.json();
        if (data && data.error) message = data.error;
      } catch {
        // keep default message on unparseable bodies
      }
      setError(message);
    }
  };

  return (
    <div className="nn-surface nn-border rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="nn-mut truncate text-sm">{item.feed_url}</p>
          {(item.categories || []).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(item.categories || []).map((name: string) => (
                <span
                  key={name}
                  className="nn-mut rounded-full border px-2 py-0.5 text-[10px]"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        {!editing ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              className="nn-btn nn-btn-ghost !px-3 !py-1.5 !text-xs"
              onClick={() => {
                setCategories((item.categories || []).join(', '));
                setError(null);
                setEditing(true);
              }}
            >
              Edit
            </button>
            <button
              className="nn-btn nn-btn-ghost shrink-0 !px-3 !py-1.5 !text-xs"
              onClick={delFeed}
            >
              Delete
            </button>
          </div>
        ) : (
          <form
            onSubmit={saveCategories}
            className="flex w-full flex-col gap-1.5 border-t pt-2 sm:w-auto sm:border-0 sm:pt-0"
          >
            <div className="flex items-center gap-1.5">
              <input
                className="nn-input sm:w-56"
                type="text"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="Categories (e.g. tech, gaming) — leave empty for none"
                aria-label={`Categories for ${item.feed_url}`}
              />
              <button
                className="nn-btn nn-btn-primary shrink-0 !px-3 !py-1.5 !text-xs"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                className="nn-btn nn-btn-ghost shrink-0 !px-3 !py-1.5 !text-xs"
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
