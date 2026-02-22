'use client';

import LogoutButton from '@/components/LogoutButton';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

const NAV_LINKS = [
  { href: '/diary', label: 'Дневник' },
  { href: '/monitoring', label: 'Мониторинг' },
  { href: '/menu', label: 'Меню' },
  { href: '/profile', label: 'Профиль' },
] as const;

interface MainNavProps {
  userName?: string | null;
  userEmail?: string | null;
}

export default function MainNav({ userName, userEmail }: MainNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 sm:h-16">
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 shrink-0"
              onClick={closeMobileMenu}
            >
              Мой доктор
            </Link>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-6">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-h-[44px]"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-300 truncate max-w-[120px] lg:max-w-[200px]">
              {userName || userEmail}
            </span>
            <div className="hidden sm:block">
              <LogoutButton />
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`sm:hidden overflow-hidden transition-[height,opacity] duration-300 ${
          mobileMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-1 bg-white dark:bg-gray-800">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMobileMenu}
              className={`relative z-10 flex items-center px-4 py-3 rounded-lg text-base font-medium min-h-[48px] touch-manipulation ${
                pathname === href
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 truncate">
              {userName || userEmail}
            </p>
            <div className="min-h-[48px] flex items-center px-4 w-fit">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
