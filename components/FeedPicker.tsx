'use client';

export function FeedUrlForm({ user }: any) {
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
    
    await res.json();
  }; 
  
  return (
    <div>
      <h2>Add a feed</h2>
      <form onSubmit={addFeed}>
        <input type='text' name='feed url' defaultValue='https://example.com/feed.rss' />
        <button className="px-4 rounded border bg-gray-300 hover:bg-blue-300" type="submit">Add Feed</button>
      </form> 
    </div>
  );
}