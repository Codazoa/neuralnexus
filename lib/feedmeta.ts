import Parser from 'rss-parser';

// Best-effort "what is this feed called?" for when a feed is first added
// (issue #26). We fetch the feed once and read its <title> — for YouTube
// channels resolved to their /feeds/videos.xml URL, rss-parser surfaces the
// channel name as the feed title; for a normal RSS feed it is the publication
// title (e.g. "The Verge"). Any failure returns null; the caller then leaves
// the stored name unset and the UI falls back to the hostname.

const PARSER_OPTS = {
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; neuralnexus/0.0; RSS)' },
};

export async function fetchFeedTitle(url: string): Promise<string | null> {
  try {
    const parser = new Parser(PARSER_OPTS);
    const feed = await parser.parseURL(url);
    const title = (feed?.title || '').trim();
    return title || null;
  } catch {
    return null;
  }
}
