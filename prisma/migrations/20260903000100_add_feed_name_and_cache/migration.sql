-- Add a human-facing display name for each feed (issue #26).
-- Nullable: populated from the feed's own <title> (or a YouTube og:title)
-- on add; overridable via PATCH /api/feeds. When NULL, the UI falls back
-- to the hostname of the feed URL (the current behaviour).
ALTER TABLE "Feeds" ADD COLUMN "name" TEXT;

-- Add the FeedCache table (issue #27).
-- One row per (user, feed): stores the most-recently-fetched items as JSON,
-- so repeated refreshes within the TTL are served from disk instead of
-- hammering the upstream provider (YouTube's rate limits are the usual
-- culprit behind "feeds stop showing up").
CREATE TABLE "FeedCache" (
    "userId" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "lastFetchedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("userId", "feedId")
);