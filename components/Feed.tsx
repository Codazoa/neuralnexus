import React from "react";
import { decodeHtmlEntities } from "@/lib/htmlentities";

interface FeedProps {
  title: string;
  link: string;
  date: Date;
  /** HTML or text body of the entry (issue #33). */
  content?: string | null;
  /** Human-facing label of where this item came from (e.g. "The Verge"). */
  source?: string | null;
  /** Image to show above the title (articles) — or used as the card visual. */
  thumbnail?: string | null;
  /** YouTube video id; when present we render an embedded player below the title. */
  videoId?: string | null;
}

/** Hide broken images instead of showing the browser's broken-icon glyph. */
function Thumbnail({ src }: { src: string }) {
  const [broken, setBroken] = React.useState(false);
  if (broken) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-48 w-full rounded-t-2xl object-cover sm:h-56"
    />
  );
}

function SourceChip({ label }: { label: string }) {
  return (
    <span className="nn-chip inline-flex max-w-full items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
      <span className="nn-mut truncate">{label}</span>
    </span>
  );
}

function YoutubeFrame({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="mx-5 mb-4 mt-3">
      <div className="aspect-video w-full overflow-hidden rounded-lg border nn-border bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&color=white`}
          title={title || "YouTube video"}
          width="100%"
          height="100%"
          allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;web-share"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      <p className="nn-mut mt-1.5 truncate px-0.5 text-xs">
        {title || "Video"}
      </p>
    </div>
  );
}

const Feed: React.FC<FeedProps> = ({
  title,
  link,
  date,
  content,
  source,
  thumbnail,
  videoId,
}) => {
  // issue #33: clicking a feed entry expands it and shows the content field.
  const [expanded, setExpanded] = React.useState(false);

  // issue #44: feed titles routinely arrive with (double) HTML character
  // references — e.g. a curly apostrophe as the literal 7 chars `&#8217;`.
  // The title is rendered as plain React text (not innerHTML), so React shows
  // those characters verbatim. Decode the safe set to real characters. Runs
  // once (SSR + client) so the title, the expand arrow, and the YouTube
  // frame caption below all show the correct glyphs.
  const displayTitle = decodeHtmlEntities(title);

  const safeDate = Number.isNaN(new Date(date).getTime()) ? new Date(0) : new Date(date);
  const formattedDate = safeDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isVideo = !!(videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId));

  // Video entries carry the embed itself below — the thumbnail above it
  // just duplicates it (issue #19), so it stays hidden for those.
  const showThumbnail = !!thumbnail && !isVideo;
  const hasContent = !!(content && content.trim());

  return (
    <article
      className={
        "nn-card nn-text overflow-hidden px-0 " +
        (showThumbnail ? "pb-4" : "py-4")
      }
    >
      {showThumbnail && <Thumbnail src={thumbnail!} />}

      <div className="px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {source && <SourceChip label={source} />}
          <span className="nn-mut text-xs">{formattedDate}</span>
        </div>

        <h3 className="nn-text mt-2 flex items-start gap-2 text-base font-semibold leading-snug sm:text-lg">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-left hover:underline"
          >
            {displayTitle}
          </button>
          <span
            className={
              "nn-mut mt-1 shrink-0 transition-transform duration-150 " +
              (expanded ? "rotate-180" : "")
            }
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </h3>

        {expanded && (
          <div className="mt-3 border-t nn-border pt-3">
            {hasContent ? (
              <div
                className="nn-article space-y-2 pr-1 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: content! }}
              />
            ) : (
              <p className="nn-mut text-sm italic">
                This feed doesn’t include the entry’s body text.
              </p>
            )}
            <div className="mt-4 flex items-center gap-2">
              <a
                className="nn-btn nn-btn-primary"
                href={link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open original
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>

      {isVideo && <YoutubeFrame videoId={videoId!} title={displayTitle} />}
    </article>
  );
};

export default Feed;
