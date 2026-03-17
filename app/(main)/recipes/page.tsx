'use client';

import VoiceInput from '@/components/diary/VoiceInput';
import { normalizeRecipeSearchQuery, withHomePrefix } from '@/lib/recipe-name';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface MenuItem {
  id: string;
  name: string;
  carbsPer100g: number;
  defaultPortionGrams: number;
  proteinPer100g?: number | null;
  fatPer100g?: number | null;
  recipeText?: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const LIST_PAGE_SIZE = 10;

export default function RecipesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [recipeText, setRecipeText] = useState('');
  const [searchResults, setSearchResults] = useState<MenuItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [parsedRecipe, setParsedRecipe] = useState<{
    name: string;
    carbsPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
  } | null>(null);
  const [addName, setAddName] = useState('');
  const [addCarbs, setAddCarbs] = useState('');
  const [addProtein, setAddProtein] = useState('');
  const [addFat, setAddFat] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [parseError, setParseError] = useState('');

  const [listItems, setListItems] = useState<MenuItem[]>([]);
  const [listPagination, setListPagination] = useState<Pagination | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [listSearchInput, setListSearchInput] = useState('');
  const [isListLoading, setIsListLoading] = useState(true);
  const [recipeModal, setRecipeModal] = useState<{ name: string; recipeText: string } | null>(null);

  const fetchList = useCallback(
    async (page = 1) => {
      if (!session) return;
      setIsListLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(LIST_PAGE_SIZE),
          recipesOnly: 'true',
        });
        if (listSearch.trim()) params.set('search', listSearch.trim());
        const res = await fetch(`/api/menu?${params}`);
        if (res.ok) {
          const data = await res.json();
          setListItems(data.items);
          setListPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error fetching recipes list:', error);
      } finally {
        setIsListLoading(false);
      }
    },
    [session, listSearch]
  );

  useEffect(() => {
    if (!session) return;
    fetchList(1);
  }, [session, fetchList]);

  useEffect(() => {
    const timer = setTimeout(() => setListSearch(listSearchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [listSearchInput]);

  useEffect(() => {
    if (listSearch !== listSearchInput.trim()) return;
    if (!session) return;
    fetchList(1);
  }, [listSearch, listSearchInput, session, fetchList]);

  const handleFindRecipe = async () => {
    const query = normalizeRecipeSearchQuery(recipeText);
    if (!query.trim()) {
      setParseError('Введите ингредиенты для поиска');
      return;
    }
    setParseError('');
    setHasSearched(true);
    setIsSearching(true);
    setParsedRecipe(null);
    try {
      const res = await fetch(
        `/api/menu?search=${encodeURIComponent(query)}&limit=10&recipesOnly=true`
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.items ?? [];
        setSearchResults(items);
        if (items.length > 0) {
          setListSearchInput(items[0].name);
          setListSearch(items[0].name);
        }
        if (items.length === 0) {
          await runParseAndShowForm();
        }
      } else {
        setSearchResults([]);
        await runParseAndShowForm();
      }
    } catch (error) {
      console.error('Search recipe error:', error);
      setSearchResults([]);
      await runParseAndShowForm();
    } finally {
      setIsSearching(false);
    }
  };

  const runParseAndShowForm = async () => {
    if (!recipeText.trim()) return;
    setIsParsing(true);
    setParseError('');
    setParsedRecipe(null);
    try {
      const res = await fetch('/api/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: recipeText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Не удалось рассчитать БЖУ');
      }
      const data = await res.json();
      const recipe = data.recipe;
      const displayName = withHomePrefix(recipe.name);
      setParsedRecipe({
        name: displayName,
        carbsPer100g: recipe.carbsPer100g,
        proteinPer100g: recipe.proteinPer100g,
        fatPer100g: recipe.fatPer100g,
      });
      setAddName(displayName);
      setAddCarbs(String(recipe.carbsPer100g));
      setAddProtein(String(recipe.proteinPer100g));
      setAddFat(String(recipe.fatPer100g));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Ошибка при расчёте БЖУ');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddRecipeToMenu = async () => {
    const name = addName.trim();
    const carbs = parseFloat(addCarbs);
    const protein = parseFloat(addProtein);
    const fat = parseFloat(addFat);
    if (!name) {
      setParseError('Введите название рецепта');
      return;
    }
    if (!Number.isFinite(carbs) || carbs < 0) {
      setParseError('Укажите корректные углеводы на 100 г');
      return;
    }
    if (!Number.isFinite(protein) || protein < 0 || !Number.isFinite(fat) || fat < 0) {
      setParseError('Укажите корректные белки и жиры на 100 г');
      return;
    }
    setParseError('');
    setIsAdding(true);
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          carbsPer100g: carbs,
          proteinPer100g: protein,
          fatPer100g: fat,
          defaultPortionGrams: 100,
          recipeText: recipeText.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось добавить рецепт');
      }
      const data = await res.json();
      const menuItemId = data.item?.id as string;
      const weight = 100;
      router.push(`/diary?addRecipeId=${encodeURIComponent(menuItemId)}&addRecipeWeight=${weight}`);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Не удалось добавить рецепт');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddExistingToDiary = (item: MenuItem) => {
    const weight = item.defaultPortionGrams ?? 100;
    router.push(`/diary?addRecipeId=${encodeURIComponent(item.id)}&addRecipeWeight=${weight}`);
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!confirm('Удалить рецепт из базы?')) return;
    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setListItems((prev) => prev.filter((i) => i.id !== id));
        if (listPagination) {
          setListPagination((p) => (p ? { ...p, total: Math.max(0, p.total - 1) } : null));
        }
      }
    } catch (error) {
      console.error('Error deleting recipe:', error);
    }
  };

  const handleVoiceResult = useCallback((text: string) => {
    setRecipeText((prev) => (prev ? `${prev}, ${text}` : text));
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
          aria-label="Загрузка"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Рецепты
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Введите ингредиенты (или нажмите микрофон) — найдём рецепт в базе или добавим новый
          </p>
        </div>

        <section className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ингредиенты рецепта
          </label>
          <textarea
            value={recipeText}
            onChange={(e) => setRecipeText(e.target.value)}
            placeholder="Например: 100 г сливочного масла, 33 г рисовой муки, 43 г пшеничной муки, 50 г сахара, 2 банана"
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-y"
          />
          <div className="mt-3">
            <VoiceInput
              onResult={handleVoiceResult}
              hideBarcode
              hidePhoto
              hideManualInput
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleFindRecipe}
              disabled={isSearching || isParsing || !recipeText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSearching ? 'Поиск…' : isParsing ? 'Расчёт БЖУ…' : 'Найти рецепт'}
            </button>
          </div>
          {parseError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{parseError}</p>
          )}

          {hasSearched && !isSearching && searchResults.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                Такой рецепт уже есть в базе. В поиске ниже подставлено название — можно добавить в дневник.
              </p>
              <ul className="space-y-2">
                {searchResults.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <span className="text-gray-900 dark:text-white">{item.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Б: {item.proteinPer100g ?? '—'} Ж: {item.fatPer100g ?? '—'} У: {item.carbsPer100g}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddExistingToDiary(item)}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      Добавить
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsedRecipe && (
            <div className="mt-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Новый рецепт (можно изменить название и БЖУ):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Название
                  </label>
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Углеводы на 100 г
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={addCarbs}
                    onChange={(e) => setAddCarbs(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Белки на 100 г
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={addProtein}
                    onChange={(e) => setAddProtein(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Жиры на 100 г
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={addFat}
                    onChange={(e) => setAddFat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddRecipeToMenu}
                disabled={isAdding}
                className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg"
              >
                {isAdding ? 'Добавление…' : 'Добавить рецепт'}
              </button>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            База рецептов
          </h2>
          <div className="mb-4">
            <input
              type="text"
              value={listSearchInput}
              onChange={(e) => setListSearchInput(e.target.value)}
              placeholder="Поиск по рецепту..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          {isListLoading ? (
            <div className="flex justify-center py-8">
              <div
                className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
                aria-label="Загрузка"
              />
            </div>
          ) : listItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-600 dark:text-gray-400">
              {listSearch ? 'Ничего не найдено' : 'Пока нет рецептов. Добавьте рецепт выше.'}
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {listItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                  >
                    <p className="font-medium text-gray-900 dark:text-white mb-1">
                      {item.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.recipeText?.trim()) {
                          setRecipeModal({ name: item.name, recipeText: item.recipeText });
                        }
                      }}
                      className={`text-left w-full text-sm text-gray-600 dark:text-gray-300 mb-3 ${item.recipeText?.trim() ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                    >
                      <span className="line-clamp-2">
                        {item.recipeText?.trim() ?? '—'}
                      </span>
                    </button>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Угл. {item.carbsPer100g} · Б {item.proteinPer100g ?? '—'} / Ж {item.fatPer100g ?? '—'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddExistingToDiary(item)}
                        className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Добавить
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecipe(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shrink-0"
                        title="Удалить рецепт"
                        aria-label="Удалить рецепт"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Название
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Ингредиенты рецепта
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Угл./100 г
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Б / Ж
                      </th>
                      <th className="w-36 sm:w-40"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listItems.map((item) => (
                      <tr key={item.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-300 text-sm max-w-xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.recipeText?.trim()) {
                                setRecipeModal({ name: item.name, recipeText: item.recipeText });
                              }
                            }}
                            className={`text-left w-full ${item.recipeText?.trim() ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                          >
                            <span className="line-clamp-2">
                              {item.recipeText?.trim() ?? '—'}
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {item.carbsPer100g}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">
                          {item.proteinPer100g ?? '—'} / {item.fatPer100g ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleAddExistingToDiary(item)}
                              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                            >
                              Добавить
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecipe(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              title="Удалить рецепт"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {listPagination && listPagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Страница {listPagination.page} из {listPagination.totalPages} ({listPagination.total})
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={listPagination.page <= 1}
                      onClick={() => fetchList(listPagination.page - 1)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      disabled={listPagination.page >= listPagination.totalPages}
                      onClick={() => fetchList(listPagination.page + 1)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Вперёд
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {recipeModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setRecipeModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-modal-title"
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="recipe-modal-title"
                className="text-lg font-semibold text-gray-900 dark:text-white mb-3 shrink-0"
              >
                {recipeModal.name}
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-y-auto flex-1 min-h-0">
                {recipeModal.recipeText}
              </p>
              <div className="mt-4 shrink-0 flex justify-end">
                <button
                  type="button"
                  onClick={() => setRecipeModal(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

