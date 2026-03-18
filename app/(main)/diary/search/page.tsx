'use client';

import { formatDateForApi, getCurrentTime } from '@/lib/date-utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

interface MenuItem {
  id: string;
  name: string;
  carbsPer100g: number;
  proteinPer100g?: number | null;
  fatPer100g?: number | null;
  defaultPortionGrams?: number | null;
  hasSugar?: boolean | null;
}

interface MealShort {
  id: string;
}

const HISTORY_STORAGE_KEY = 'healthDiaryFoodSearchHistory';
const HISTORY_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 400;

function normalizeDateParam(value: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function extractWeightFromText(phrase: string): number {
  const match = phrase.match(/(\d+)\s*(г|грамм[а-я]*|гр\.?)?/i);
  if (match) {
    const n = parseInt(match[1], 10);
    return n > 0 && n <= 10000 ? n : 100;
  }
  return 100;
}

function extractProductName(text: string): string {
  let cleaned = text
    .replace(/\d+\s*(г|грамм[а-я]*|гр\.?|мл|кг|л)/gi, '')
    .trim();
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || text;
}

export default function DiaryFoodSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = useMemo(
    () => normalizeDateParam(searchParams.get('date')),
    [searchParams]
  );
  const dateStr = useMemo(() => formatDateForApi(selectedDate), [selectedDate]);

  const [queryInput, setQueryInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const trimmedQuery = useMemo(() => queryInput.trim(), [queryInput]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHistory(
          parsed
            .filter((x) => typeof x === 'string')
            .slice(0, HISTORY_LIMIT)
        );
      }
    } catch {
      // игнорируем ошибки чтения localStorage
    }
  }, []);

  const saveHistory = (items: string[]) => {
    setHistory(items);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // игнорируем ошибки записи localStorage
    }
  };

  const pushToHistory = (value: string) => {
    const v = value.trim();
    if (!v) return;
    const next = [v, ...history.filter((x) => x !== v)].slice(0, HISTORY_LIMIT);
    saveHistory(next);
  };

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setError(null);
      return;
    }
    setError(null);
    const timer = window.setTimeout(
      () => setSearchQuery(trimmedQuery),
      SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [trimmedQuery]);

  useEffect(() => {
    if (!searchQuery) return;
    let aborted = false;
    const controller = new AbortController();

    const fetchMenu = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          search: searchQuery,
          limit: '20',
        });
        const res = await fetch(`/api/menu?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (!aborted) {
            setResults([]);
            setError('Не удалось выполнить поиск по меню');
          }
          return;
        }
        const data = await res.json();
        if (!aborted) {
          setResults((data.items ?? []) as MenuItem[]);
          setError(null);
        }
      } catch (e) {
        if (aborted) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        setResults([]);
        setError('Ошибка сети при поиске');
      } finally {
        if (!aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchMenu();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [searchQuery]);

  const goBackToDiary = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/diary');
  };

  const getOrCreateLastMealId = async (): Promise<string> => {
    const mealsRes = await fetch(`/api/meals?date=${encodeURIComponent(dateStr)}`);
    if (!mealsRes.ok) {
      throw new Error('Не удалось получить приёмы пищи');
    }

    const mealsData = await mealsRes.json();
    const meals = (mealsData.meals ?? []) as MealShort[];
    if (meals.length > 0) {
      const lastMeal = meals[meals.length - 1];
      return lastMeal.id;
    }

    const createRes = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: `${dateStr}T12:00:00.000Z`,
        time: getCurrentTime(),
      }),
    });
    if (!createRes.ok) {
      throw new Error('Не удалось создать приём пищи');
    }
    const createData = await createRes.json();
    return createData.meal.id as string;
  };

  const handleSelectHistory = (value: string) => {
    setQueryInput(value);
  };

  const handleSelectMenuItem = async (item: MenuItem) => {
    try {
      setIsLoading(true);
      setError(null);

      const mealId = await getOrCreateLastMealId();
      const weightGrams = item.defaultPortionGrams ?? 100;
      const body: Record<string, unknown> = {
        name: item.name,
        carbsPer100g: item.carbsPer100g,
        proteinPer100g: item.proteinPer100g ?? 0,
        fatPer100g: item.fatPer100g ?? 0,
        weightGrams,
        menuItemId: item.id,
      };
      if (item.hasSugar) {
        body.sugarsPer100g = 1;
      }

      const res = await fetch(`/api/meals/${encodeURIComponent(mealId)}/foods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось добавить продукт из меню');
      }

      pushToHistory(item.name);
      goBackToDiary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при добавлении продукта');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAsFreeText = async () => {
    const text = trimmedQuery;
    if (!text) return;

    try {
      setIsLoading(true);
      setError(null);

      const mealId = await getOrCreateLastMealId();
      const productName = extractProductName(text);
      let weightGrams = extractWeightFromText(text);
      let name: string;
      let carbsPer100g: number;
      let proteinPer100g: number;
      let fatPer100g: number;
      let sugarsPer100g: number | undefined;
      let menuItemId: string | undefined;

      const menuRes = await fetch(
        `/api/menu?search=${encodeURIComponent(productName)}&limit=5`
      );

      if (menuRes.ok) {
        const menuData = await menuRes.json();
        const menuItems = (menuData.items ?? []) as MenuItem[];
        if (menuItems.length > 0) {
          const first = menuItems[0];
          name = first.name;
          carbsPer100g = first.carbsPer100g;
          proteinPer100g = first.proteinPer100g ?? 0;
          fatPer100g = first.fatPer100g ?? 0;
          menuItemId = first.id;
          if (first.hasSugar) {
            sugarsPer100g = 1;
          }
          if (first.defaultPortionGrams && first.defaultPortionGrams > 0) {
            weightGrams = first.defaultPortionGrams;
          }
        } else {
          const parseRes = await fetch('/api/parse-food', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (parseRes.ok) {
            const parseData = await parseRes.json();
            const food = parseData.food ?? parseData;
            name = food.name ?? productName ?? text;
            carbsPer100g = Number(food.carbsPer100g) || 0;
            proteinPer100g = Number(food.proteinPer100g) || 0;
            fatPer100g = Number(food.fatPer100g) || 0;
            const s = Number(food.sugarsPer100g);
            sugarsPer100g = Number.isNaN(s) ? undefined : Math.max(0, s);
            if (typeof food.weightGrams === 'number' && food.weightGrams > 0) {
              weightGrams = food.weightGrams;
            }
          } else {
            name = productName || text;
            carbsPer100g = 0;
            proteinPer100g = 0;
            fatPer100g = 0;
            sugarsPer100g = undefined;
          }
        }
      } else {
        const parseRes = await fetch('/api/parse-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (parseRes.ok) {
          const parseData = await parseRes.json();
          const food = parseData.food ?? parseData;
          name = food.name ?? productName ?? text;
          carbsPer100g = Number(food.carbsPer100g) || 0;
          proteinPer100g = Number(food.proteinPer100g) || 0;
          fatPer100g = Number(food.fatPer100g) || 0;
          const s = Number(food.sugarsPer100g);
          sugarsPer100g = Number.isNaN(s) ? undefined : Math.max(0, s);
          if (typeof food.weightGrams === 'number' && food.weightGrams > 0) {
            weightGrams = food.weightGrams;
          }
        } else {
          name = productName || text;
          carbsPer100g = 0;
          proteinPer100g = 0;
          fatPer100g = 0;
          sugarsPer100g = undefined;
        }
      }

      const body: Record<string, unknown> = {
        name,
        carbsPer100g,
        proteinPer100g,
        fatPer100g,
        weightGrams,
      };
      if (menuItemId) body.menuItemId = menuItemId;
      if (sugarsPer100g !== undefined) body.sugarsPer100g = sugarsPer100g;

      const res = await fetch(`/api/meals/${encodeURIComponent(mealId)}/foods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось добавить продукт');
      }

      pushToHistory(text);
      goBackToDiary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при добавлении продукта');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={goBackToDiary}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
            aria-label="Назад в дневник"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Поиск продукта
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Выбранный продукт добавится в последний приём пищи за этот день.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Например: 150г гречки или просто «гречка»"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            autoFocus
          />
        </div>

        {history.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Последние запросы
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelectHistory(item)}
                  className="px-3 py-1.5 text-sm rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 touch-manipulation"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          {isLoading && (
            <p className="text-sm text-gray-600 dark:text-gray-400">Поиск...</p>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {!isLoading && !error && searchQuery && results.length === 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ничего не найдено в меню.
            </p>
          )}
          {results.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectMenuItem(item)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                      У: {item.carbsPer100g} г/100 г
                      {item.proteinPer100g != null && <> · Б: {item.proteinPer100g} г</>}
                      {item.fatPer100g != null && <> · Ж: {item.fatPer100g} г</>}
                    </div>
                  </div>
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    В последний приём
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleAddAsFreeText}
            disabled={!trimmedQuery || isLoading}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            Добавить как новый продукт
          </button>
          <button
            type="button"
            onClick={goBackToDiary}
            className="min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
