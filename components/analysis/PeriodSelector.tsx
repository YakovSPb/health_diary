'use client';

const PERIODS = [
  { value: '7', label: '7 дней' },
  { value: '30', label: 'Месяц' },
  { value: '180', label: '6 месяцев' },
  { value: '365', label: 'Год' },
] as const;

export type PeriodDays = (typeof PERIODS)[number]['value'];

interface PeriodSelectorProps {
  value: PeriodDays;
  onChange: (value: PeriodDays) => void;
  disabled?: boolean;
}

export function PeriodSelector({
  value,
  onChange,
  disabled = false,
}: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERIODS.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v as PeriodDays)}
          disabled={disabled}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
            value === v
              ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
