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
      window.location.href = '/';
    } catch {
      // ignore
      window.location.href = '/';
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex items-center justify-between rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600 ring-1 ring-black/5">
      <span>
        Device key:{' '}
        <span className="font-mono">{masked || 'nnx_…'}</span>
      </span>
      <button
        onClick={lock}
        disabled={busy}
        className="rounded bg-white px-2 py-1 font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
      >
        {busy ? 'Locking…' : 'Lock'}
      </button>
    </div>
  );
}
