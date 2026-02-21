'use client';

import type { ReactNode } from 'react';

interface DiaryHeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  voiceAddButton?: ReactNode;
}

export default function DiaryHeader({
  selectedDate,
  onDateChange,
  voiceAddButton,
}: DiaryHeaderProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const touchButtonClass =
    'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors touch-manipulation active:scale-95';

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {voiceAddButton != null ? <div className="flex items-center gap-2">{voiceAddButton}</div> : null}
        <div className="flex flex-1 items-center justify-center gap-2 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => changeDate(-1)}
            className={`${touchButtonClass} p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300`}
            aria-label="Предыдущий день"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center min-w-0 flex-1 px-2">
            <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white capitalize truncate">
              {formatDate(selectedDate)}
            </div>
            {!isToday && (
              <button
                type="button"
                onClick={goToToday}
                className="mt-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 min-h-[44px] touch-manipulation"
              >
                Перейти к сегодня
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => changeDate(1)}
            className={`${touchButtonClass} p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300`}
            aria-label="Следующий день"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
