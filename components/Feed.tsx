import React from "react";

interface FeedProps {
  title: string;
  key: number;
  link: string;
  date: Date;
}

const Feed: React.FC<FeedProps> = ({title, link, date}) => {
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <>
    <div className="w-3/4 max-w-lg border mx-auto p-5 rounded-xl">
      <a href={link} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="hover:text-blue-500 hover:opacity-70"
      >
        <h3 className="text-xl mb-1 underline decoration-blue-400">{title}</h3>
        <p>{formattedDate}</p>
      </a>
    </div>
    </>
  );
}

export default Feed;
