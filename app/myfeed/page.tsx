'use client'
import { useState, useEffect } from "react";
import Feed from "../../components/Feed";

interface Article {
  key: number;
  title: string;
  link: string;
  pubDate: Date;
}

export default function MyFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);

  const pages_to_show = 10;
  const articles_to_get = 100;
  const max_pages = Math.floor(articles_to_get/pages_to_show);

  const changePage = (x: number) => {
    setPage(Math.max(1, Math.min(max_pages,page + x)));
  };

  const getArticles = async () => {
    const res = await fetch('/api/feeds/links', {
      method: 'GET'
    });

    const data = await res.json();
    setArticles(data);
  };

  useEffect(() => {
    getArticles();
  }, []); // Call getArticles when the component mounts
  
  return (
    <div className='bg-gray-600'>
      {/* Holding feed elements */}
      <div className="fixed items-center w-screen bottom-10 top-10 my-10 overflow-y-scroll pb-4 bg-gray-900">
        {articles.slice((page-1)*pages_to_show, ((page-1)*pages_to_show)+pages_to_show)
          .map((item:Article, i: number) =>
            <div className='pb-1'>
              <Feed
                key={i}
                title={item.title}
                link={item.link}
                date={item.pubDate}
              />
              {/* <hr className='my-3' style={{ width: '50%' }} /> */}
            </div>
          )}
      </div>
      
      {/* Holding footer elements */}
      <div className="flex fixed border bottom-0 left-0 align-middle w-full items-center justify-center mt-1 bg-orange-100 p-5">
        <button className="mx-3 bg-orange-600 rounded px-4 py-2" onClick={() => setPage(1)}>First</button>
        <button className="mx-3 bg-orange-600 rounded px-4 py-2" onClick={() => changePage(-1)}>Prev</button>
        <h3 className="text-3xl font-bold">{page}</h3>
        <button className="mx-3 bg-orange-600 rounded px-4 py-2" onClick={() => changePage(1)}>Next</button>
        <button className="mx-3 bg-orange-600 rounded px-4 py-2" onClick={() => setPage(max_pages)}>Last</button>
      </div>
    </div>
  );
}
