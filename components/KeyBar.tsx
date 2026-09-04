'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { maskKey } from '@/lib/keyclient';

// Small key-status bar: shows the masked device key and a Lock button
// that clears the session cookie.
export default function KeyBar() {
  const router = useRouter();
  const [masked, setMasked] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const k = localStorage.getItem('nnx_private_key');
      if (k) setMasked(maskKey(k));
    } catch {
      // ignore
    }
  }, []);

  const lock = async () => {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
    window.location.href = '/';
  };

  return (
    <div className="mx-auto mt-4 max-w-3xl px-4 sm:mt-5">
      <div className="nn-surface-2 nn-border flex items-center justify-between rounded-r-lg px-3 py-2 text-xs">
        <span className="nn-mut">
          Device key:{' '}
          <span className="nn-text font-mono">{masked || 'nnx_…'}</span>
        </span>
        <button
          onClick={lock}
          disabled={busy}
          className="nn-btn nn-btn-ghost !px-3 !py-1.5 !text-xs"
        >
          {busy ? 'Locking…' : 'Lock'}
        </button>
      </div>
    </div>
  );
}
