'use client';

import ConnectWatchHelp from '@/components/monitoring/ConnectWatchHelp';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface WearableRecord {
  id: string;
  type: string;
  value: number;
  unit: string | null;
  date: string;
  source: string;
}

const TYPE_LABELS: Record<string, string> = {
  steps: 'Шаги',
  sleep_minutes: 'Сон',
  heart_rate: 'Пульс',
  weight: 'Вес',
  blood_oxygen: 'Кислород в крови',
  active_calories: 'Активные калории',
  floors_climbed: 'Этажи',
  body_temperature: 'Температура тела',
  stress: 'Стресс',
  water_ml: 'Вода',
};

const TYPE_UNITS: Record<string, string> = {
  steps: 'шаг.',
  sleep_minutes: 'мин',
  heart_rate: 'уд/мин',
  weight: 'кг',
  blood_oxygen: '%',
  active_calories: 'ккал',
  floors_climbed: 'эт.',
  body_temperature: '°C',
  stress: '',
  water_ml: 'мл',
};

function formatValue(record: WearableRecord): string {
  const unit = record.unit ?? TYPE_UNITS[record.type] ?? '';
  const value = Number.isInteger(record.value) ? record.value : record.value.toFixed(1);
  return unit ? `${value} ${unit}` : String(value);
}

const PERIODS = [
  { label: '7 дней', days: 7 },
  { label: '30 дней', days: 30 },
  { label: '90 дней', days: 90 },
] as const;

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export default function MonitoringPage() {
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [data, setData] = useState<WearableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { from, to } = getDateRange(periodDays);
    try {
      const res = await fetch(`/api/wearable/data?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Ошибка загрузки');
        setData([]);
        return;
      }
      const json = await res.json();
      setData(json.data ?? []);
    } catch (e) {
      setError('Ошибка загрузки данных');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const byType = data.reduce<Record<string, WearableRecord[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  const sortedTypes = Object.keys(byType).sort();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Мониторинг
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Данные с Samsung Watch и других носимых устройств
          </p>
        </div>

        <ConnectWatchHelp />

        <div className="flex flex-wrap gap-2 mb-6">
          {PERIODS.map(({ label, days }) => (
            <button
              key={days}
              type="button"
              onClick={() => setPeriodDays(days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                periodDays === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            Загрузка…
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Нет данных за выбранный период.
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              Подключите часы и настройте синхронизацию в приложении (см. раздел «Интеграция с Samsung Watch» в документации).
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedTypes.map((type) => {
              const records = byType[type];
              const label = TYPE_LABELS[type] ?? type;
              return (
                <section
                  key={type}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                >
                  <h2 className="px-4 py-3 sm:px-6 sm:py-4 text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700">
                    {label}
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      {records.length} записей
                    </span>
                  </h2>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                    {records.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-3 text-sm"
                      >
                        <time
                          dateTime={r.date}
                          className="text-gray-600 dark:text-gray-400 shrink-0 mr-4"
                        >
                          {format(new Date(r.date), 'd MMM yyyy, HH:mm', { locale: ru })}
                        </time>
                        <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                          {formatValue(r)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
