export default function LoadingArticles() {
  return (
    <div className="nn-bg mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
      <span className="nn-mut text-sm" aria-live="polite">
        Fetching your articles…
      </span>
    </div>
  );
}
