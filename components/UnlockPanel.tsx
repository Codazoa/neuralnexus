'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  generatePrivateKey,
  loadPrivateKey,
  savePrivateKey,
} from '@/lib/keyclient';

type ApiError = { error?: string };

// The unlock screen. On a fresh device a new private key is generated
// locally and offered to the user (shown once). Unlocking sends the key
// to /api/auth/login, which registers it (first key on a fresh DB) or
// validates it, and sets the session cookie.
export default function UnlockPanel() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [isFreshKey, setIsFreshKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadPrivateKey();
    if (saved) {
      setKey(saved);
    } else {
      const fresh = generatePrivateKey();
      savePrivateKey(fresh);
      setKey(fresh);
      setIsFreshKey(true);
      // Keep the fresh key visible for copying.
      setKey(fresh);
    }
  }, []);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as { registered?: boolean } & ApiError;
      if (!res.ok) {
        setError(data.error || 'Unlock failed');
        if (res.status === 401 && !isFreshKey) {
          // Key no longer registered (device was reset?): offer a fresh one.
          const fresh = generatePrivateKey();
          savePrivateKey(fresh);
          setKey(fresh);
          setIsFreshKey(true);
        }
        return;
      }
      // Unlocked — server component will re-render with the session.
      router.refresh();
      window.location.reload();
    } catch {
      setError('Could not reach the server');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
      <form
        onSubmit={unlock}
        className="w-full max-w-xl rounded-xl bg-white p-8 shadow-lg ring-1 ring-black/5"
      >
        <h1 className="text-2xl font-bold">Unlock NeuralNexus</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Enter your device private key to sign in. No passwords, no
          accounts — the key lives on this device.
        </p>

        {isFreshKey && (
          <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm ring-1 ring-yellow-200">
            <strong className="font-semibold">
              First run: this is your private key.
            </strong>{' '}
            Save it in a password manager right now — if the database is
            ever lost, this key is the only way to keep your feeds.
            <div className="mt-2 select-all break-all bg-white p-2 font-mono text-xs ring-1 ring-yellow-200">
              {key}
            </div>
          </div>
        )}

        <label className="mt-4 block text-sm font-medium">Private key</label>
        <input
          value={key}
          onChange={(e) => {
            setIsFreshKey(false);
            setKey(e.target.value);
          }}
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 font-mono text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="nnx_…"
          spellCheck={false}
        />

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="mt-4 w-full rounded-md bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
