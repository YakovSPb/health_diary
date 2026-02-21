'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ConnectWatchHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-gray-900 dark:text-white">
          Как подключить часы?
        </span>
        <svg
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0 border-t border-gray-100 dark:border-gray-700">
          <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <li>
              <strong>Сопрягите часы с телефоном.</strong> Samsung Watch 7 должны быть подключены к Android-смартфону через приложение Samsung Wear / Galaxy Wearable. Данные автоматически попадают в Samsung Health.
            </li>
            <li>
              <strong>Создайте токен в профиле.</strong> Зайдите в{' '}
              <Link href="/profile" className="text-blue-600 dark:text-blue-400 underline hover:no-underline">
                Профиль
              </Link>
              , в блоке «Подключение часов» нажмите «Создать токен». Скопируйте токен и сохраните его — он показывается только один раз.
            </li>
            <li>
              <strong>Установите приложение-синхронизатор</strong> на телефон (его нужно разработать отдельно: оно читает данные из Samsung Health или Health Connect и отправляет их на этот сайт). В приложении укажите адрес сайта и вставьте токен. После этого данные начнут появляться на этой странице.
            </li>
          </ol>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Технические детали и план разработки приложения — в документации проекта, раздел «Интеграция с Samsung Watch».
          </p>
        </div>
      )}
    </div>
  );
}
