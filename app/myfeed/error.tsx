'use client'; // Error components must be Client components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="nn-bg mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h2 className="nn-text text-2xl font-bold">Something went wrong!</h2>
      <p className="nn-mut mt-2 text-sm">
        We could not load your feed. Give it another try.
      </p>
      <button onClick={() => reset()} className="nn-btn nn-btn-primary mt-5">
        Try again
      </button>
    </div>
  );
}
