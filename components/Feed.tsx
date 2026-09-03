import React from "react";

interface FeedProps {
  title: string;
  link: string;
  date: Date;
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
  source,
  thumbnail,
  videoId,
}) => {
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

        <h3 className="nn-text mt-2 text-base font-semibold leading-snug sm:text-lg">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {title}
          </a>
        </h3>
      </div>

      {isVideo && <YoutubeFrame videoId={videoId!} title={title} />}
    </article>
  );
};

export default Feed;
