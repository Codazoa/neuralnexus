'use client';

import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'nnx_theme';

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function currentTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable — fall back to system.
  }
  return systemTheme();
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  // Sync state with the attribute the inline bootstrap script (in the
  // document head) already applied before first paint.
  useEffect(() => {
    setTheme(currentTheme());
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — theme still applies for this session.
    }
    setTheme(next);
  }, []);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="nn-btn nn-btn-ghost !px-2.5 !py-2 text-base leading-none"
    >
      {/* Sun / moon */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isDark ? (
          <>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        )}
      </svg>
      {/* hidden text keeps the button a stable square size */}
      {!ready && <span className="sr-only">Toggle theme</span>}
    </button>
  );
}
