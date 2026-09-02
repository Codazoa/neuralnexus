import React from "react";

interface FeedProps {
  title: string;
  link: string;
  date: Date;
}

const Feed: React.FC<FeedProps> = ({ title, link, date }) => {
  const safeDate = Number.isNaN(new Date(date).getTime()) ? new Date(0) : new Date(date);
  const formattedDate = safeDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="nn-card nn-text block px-5 py-4"
    >
      <h3 className="nn-text text-base font-semibold leading-snug sm:text-lg">
        {title}
      </h3>
      <p className="nn-mut mt-1 text-xs">{formattedDate}</p>
      <span className="nn-accent mt-2 inline-flex items-center gap-1 text-xs font-medium">
        Read on source
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7M8 7h9v9" />
        </svg>
      </span>
    </a>
  );
}

export default Feed;
