'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="min-h-[44px] min-w-[44px] sm:min-w-0 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 active:opacity-80 transition-colors touch-manipulation rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      Выйти
    </button>
  );
}
