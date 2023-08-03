'use client';

import { useRouter } from "next/navigation";

export function FeedUrlForm({ user }: any) {
  const router = useRouter();

  const addFeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const body = {
      url: formData.get('feed url')
    };

    const res = await fetch('/api/feeds', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json'
      },
    });

    const data = await res.json();
    router.refresh();
  };
  
  return (
    <div>
      <h2>Add a feed</h2>
      <form onSubmit={addFeed}>
        <div className='flex'>
          <div className='pr-2'>
            <button className="px-4 rounded border bg-gray-300 hover:bg-blue-300" type="submit">Add Feed</button>
          </div>
          <input className='border rounded px-4 w-96' type='text' name='feed url' defaultValue='https://example.com/feed.rss' />
        </div>
      </form>
    </div>
  );
}

export function FeedDeleteForm({ item }: any) {
  const router = useRouter();

  const delFeed = async () => {
    const res = await fetch(`/api/feeds?feedId=${item.id}`, {
      method: 'DELETE'
    })

    router.refresh();
  }



  return (
    <div className='flex py-2'>
      <div className='pr-2'>
        <button className="rounded px-4 bg-gray-300"
          onClick={delFeed}>Delete</button>
      </div>
      <p className='bg-white rounded px-4'>{item.feed_url}</p>
    </div>
  );
}