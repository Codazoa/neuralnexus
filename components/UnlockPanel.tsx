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
      <main className="nn-bg mx-auto flex min-h-[75vh] max-w-3xl flex-col items-center justify-center px-6">
        <span className="nn-mut text-sm" aria-live="polite">
          Loading…
        </span>
      </main>
    );
  }

  return (
    <main className="nn-bg mx-auto flex min-h-[75vh] max-w-3xl flex-col items-center justify-center px-4 py-8 sm:px-6">
      <form
        onSubmit={unlock}
        className="nn-surface nn-border w-full max-w-xl rounded-2xl border p-6 shadow-lg sm:p-8"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--nn-accent)_14%,transparent)] text-lg">
          <span className="nn-accent font-black">N</span>
        </div>

        <h1 className="nn-text text-center text-2xl font-bold tracking-tight">
          Unlock NeuralNexus
        </h1>
        <p className="nn-mut mt-1 text-center text-sm">
          Sign in with your private key. No passwords, no accounts — one key,
          every device.
        </p>

            {isOwnerMode && (
              <>
                <div className="nn-surface-2 nn-border mt-5 rounded-r-lg border p-3 text-sm">
                  <strong className="nn-text font-semibold">
                    First run: this is your private key.
                  </strong>{' '}
                  <span className="nn-mut">
                    Save it now — it is shown once, and it unlocks the app on
                    any device (phone, laptop, tablet) as long as they point
                    at the same database.
                  </span>
                  <div className="nn-surface nn-border mt-2.5 flex items-stretch gap-2 rounded-md border">
                    <div className="nn-text min-w-0 flex-1 select-all break-all p-2 font-mono text-xs">
                      {key}
                    </div>
                    <button
                      type="button"
                      onClick={copyKey}
                      className="nn-accent-soft shrink-0 rounded-r-md px-3 text-xs font-semibold"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <label className="nn-text mt-4 block text-sm font-medium">
                  Private key
                </label>
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="nn-input nn-text mt-1.5 font-mono"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="Your private key"
                />
              </>
            )}

            {!isOwnerMode && (
              <>
                <label className="nn-text mt-4 block text-sm font-medium">
                  Private key
                </label>
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="nn-input nn-text mt-1.5 font-mono"
                  placeholder="nnx_…"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="Your private key"
                />
                <p className="nn-mut mt-2 text-xs leading-relaxed">
                  This is the key that was shown on the first device that set
                  up this database. If you are setting up a new device, enter
                  that key here — do not generate a new one.
                </p>
              </>
            )}

            {error && (
              <p
                className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !key.trim()}
              className="nn-btn nn-btn-primary mt-5 w-full !py-2.5"
            >
              {busy
                ? 'Unlocking…'
                : isOwnerMode
                  ? 'Save key & unlock'
                  : 'Unlock'}
            </button>
      </form>
    </main>
  );
}
