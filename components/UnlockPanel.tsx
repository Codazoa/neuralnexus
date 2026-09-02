'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  generatePrivateKey,
  loadPrivateKey,
  savePrivateKey,
} from '@/lib/keyclient';

type ApiError = { error?: string };

// The unlock screen. Two modes, decided on mount by GET /api/auth/state:
//
// Owner mode (fresh database, nothing registered yet):
//   A new private key is generated locally, shown once with a copy
//   button, and saving it on unlock registers it. The same key opens
//   the app on any device that points at this database.
//
// Unlock mode (a key is already registered — this is the normal case
// for a second device):
//   Enter the existing key. Only a saved key is prefilled; nothing is
//   auto-generated, so there is nothing to accidentally "register"
//   over the owner.

export default function UnlockPanel() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [isOwnerMode, setIsOwnerMode] = useState(false);
  const [stateKnown, setStateKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let initialized = true;
      try {
        const res = await fetch('/api/auth/state');
        const data = (await res.json()) as { initialized?: boolean };
        if (typeof data.initialized === 'boolean') initialized = data.initialized;
      } catch {
        // Server unreachable: keep the safe unlock-mode default.
      }
      if (cancelled) return;
      const savedKey = loadPrivateKey();
      if (!initialized) {
        // Owner mode: nothing registered yet. Prefill a previously
        // saved key if any (e.g. this is still the owner's browser
        // after a browser-profile loss); otherwise generate a new one.
        if (savedKey) {
          setKey(savedKey);
        } else {
          const fresh = generatePrivateKey();
          savePrivateKey(fresh);
          setKey(fresh);
        }
        setIsOwnerMode(true);
      } else {
        setKey(savedKey || '');
      }
      setStateKnown(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context): the key
      // is selectable below, so the user can long-press to copy.
      setError('Copy failed — long-press the key to copy it manually.');
    }
  }, [key]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stateKnown || busy || !key.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as { registered?: boolean } & ApiError;
      if (!res.ok) {
        if (isOwnerMode) {
          // Owner flow on a fresh DB should always succeed locally;
          // an error here means registration genuinely failed.
          if (/not registered/i.test(data.error || '')) {
            // Another device registered a key between our state
            // check and this attempt — switch to unlock mode and
            // keep the entered key.
            setIsOwnerMode(false);
            setError(
              'A key is already registered. Enter your existing NeuralNexus key to unlock.'
            );
          } else {
            setError(data.error || 'Unlock failed');
          }
        } else {
          setError(data.error || 'Unlock failed');
        }
        return;
      }
      // Success — the server sets the session cookie. Remember the key
      // for this browser from now on, then reload into the app.
      savePrivateKey(key.trim());
      setSaved(true);
      router.refresh();
      window.location.reload();
    } catch {
      setError('Could not reach the server');
    } finally {
      setBusy(false);
    }
  };

  if (!stateKnown) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
        <p className="text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6">
      <form
        onSubmit={unlock}
        className="w-full max-w-xl rounded-xl bg-white p-8 shadow-lg ring-1 ring-black/5"
      >
        <h1 className="text-2xl font-bold">Unlock NeuralNexus</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Sign in with your private key. No passwords, no accounts — one key,
          every device.
        </p>

        {isOwnerMode && (
          <>
            <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm ring-1 ring-yellow-200">
              <strong className="font-semibold">
                First run: this is your private key.
              </strong>{' '}
              Save it now — it is shown once, and it unlocks the app on any
              device (phone, laptop, tablet) as long as they point at the same
              database.
              <div className="mt-2 flex items-start gap-2">
                <div className="min-w-0 flex-1 select-all break-all bg-white p-2 font-mono text-xs ring-1 ring-yellow-200">
                  {key}
                </div>
                <button
                  type="button"
                  onClick={copyKey}
                  className="shrink-0 rounded-md bg-white px-3 py-2 text-xs font-semibold ring-1 ring-yellow-300 hover:bg-yellow-50"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <label className="mt-4 block text-sm font-medium">
              Private key
            </label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 font-mono text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              spellCheck={false}
              autoComplete="off"
              aria-label="Your private key"
            />
          </>
        )}

        {!isOwnerMode && (
          <>
            <label className="mt-4 block text-sm font-medium">Private key</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 p-2 font-mono text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="nnx_…"
              spellCheck={false}
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-neutral-500">
              This is the key that was shown on the first device that set up
              this database. If you are setting up a new device, enter that
              key here — do not generate a new one.
            </p>
          </>
        )}

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
          {busy ? 'Unlocking…' : isOwnerMode ? 'Save key & unlock' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
