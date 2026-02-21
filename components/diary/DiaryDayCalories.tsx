'use client';

interface DiaryDayCaloriesProps {
  dayTotalCalories: number;
  targetCaloriesPerDay: number | null;
}

/** Блок внизу дневника: за день ккал и баланс (остаток до цели). Зелёный если остаток > 0, красный если < 0. */
export default function DiaryDayCalories({
  dayTotalCalories,
  targetCaloriesPerDay,
}: DiaryDayCaloriesProps) {
  const hasTarget = targetCaloriesPerDay != null && targetCaloriesPerDay > 0;
  const balance = hasTarget
    ? Math.round(targetCaloriesPerDay - dayTotalCalories)
    : null;

  return (
    <div className="mt-6 p-4 rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="font-semibold text-gray-700 dark:text-gray-300">
          За день: {Math.round(dayTotalCalories)} ккал
        </div>
        {balance !== null && (
          <div
            className={
              balance >= 0
                ? 'text-green-600 dark:text-green-400 font-semibold'
                : 'text-red-600 dark:text-red-400 font-semibold'
            }
          >
            {balance >= 0
              ? `${balance} ккал`
              : `Превышение: ${-balance} ккал`}
          </div>
        )}
      </div>
      {hasTarget && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Цель в день: {targetCaloriesPerDay} ккал (норма − дефицит)
        </p>
      )}
    </div>
  );
}
