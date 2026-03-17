'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="flex items-center justify-between gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">Тёмная тема</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Включена по умолчанию, можно выключить
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={theme === 'dark'}
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        className={[
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'focus:ring-offset-white dark:focus:ring-offset-gray-800',
          theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
            theme === 'dark' ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

