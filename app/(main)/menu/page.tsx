'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

interface MenuItem {
  id: string;
  name: string;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  caloriesPer100g: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

export default function MenuPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [addName, setAddName] = useState('');
  const [addCarbs, setAddCarbs] = useState('');
  const [addProtein, setAddProtein] = useState('');
  const [addFat, setAddFat] = useState('');

  const fetchItems = useCallback(
    async (page = 1) => {
      if (!session) return;
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (search.trim()) params.set('search', search.trim());
        const res = await fetch(`/api/menu?${params}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error fetching menu:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [session, search]
  );

  useEffect(() => {
    if (!session) return;
    fetchItems(1);
  }, [session, fetchItems]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 600);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCarbs(String(item.carbsPer100g));
    setEditProtein(String(item.proteinPer100g));
    setEditFat(String(item.fatPer100g));
    setEditCalories(String(item.caloriesPer100g));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCarbs('');
    setEditProtein('');
    setEditFat('');
    setEditCalories('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const carbsNum = parseFloat(editCarbs);
    const proteinNum = parseFloat(editProtein);
    const fatNum = parseFloat(editFat);
    const calNum = parseFloat(editCalories);
    if (Number.isNaN(carbsNum) || carbsNum < 0) return;
    try {
      const res = await fetch(`/api/menu/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          carbsPer100g: carbsNum,
          proteinPer100g: Number.isNaN(proteinNum) ? 0 : proteinNum,
          fatPer100g: Number.isNaN(fatNum) ? 0 : fatNum,
          caloriesPer100g: Number.isNaN(calNum) ? undefined : calNum,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => prev.map((i) => (i.id === editingId ? data.item : i)));
        cancelEdit();
      }
    } catch (error) {
      console.error('Error updating menu item:', error);
    }
  };

  const handleAdd = async () => {
    const name = addName.trim();
    if (!name) return;
    const carbsNum = parseFloat(addCarbs);
    const proteinNum = parseFloat(addProtein);
    const fatNum = parseFloat(addFat);
    if (Number.isNaN(carbsNum) || carbsNum < 0) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          carbsPer100g: carbsNum,
          proteinPer100g: Number.isNaN(proteinNum) ? 0 : proteinNum,
          fatPer100g: Number.isNaN(fatNum) ? 0 : fatNum,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [data.item, ...prev]);
        setAddName('');
        setAddCarbs('');
        setAddProtein('');
        setAddFat('');
        if (pagination) {
          setPagination((p) => (p ? { ...p, total: p.total + 1 } : null));
        }
      }
    } catch (error) {
      console.error('Error adding menu item:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить блюдо из меню?')) return;
    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (pagination) {
          setPagination((p) => (p ? { ...p, total: Math.max(0, p.total - 1) } : null));
        }
      }
    } catch (error) {
      console.error('Error deleting menu item:', error);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
      </div>
    );
  }

  const inputClass =
    'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white min-h-[44px] w-full';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Меню
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Сохранённые блюда с БЖУ и калориями на 100 г для быстрого добавления в дневник
          </p>
        </div>

        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Добавить блюдо</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Название</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Название"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Белки, г/100</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={addProtein}
                onChange={(e) => setAddProtein(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Жиры, г/100</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={addFat}
                onChange={(e) => setAddFat(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Углеводы, г/100</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={addCarbs}
                onChange={(e) => setAddCarbs(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={handleAdd}
                className="w-full min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {isLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-600 dark:text-gray-400">
            {search ? 'Ничего не найдено' : 'Пока нет сохранённых блюд. Добавьте выше или сохраните из дневника.'}
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Название</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Б</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Ж</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">У</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">ккал/100г</th>
                    <th className="w-24 sm:w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="py-3 px-4">
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`w-full ${inputClass}`}
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-white">{item.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.1}
                            value={editProtein}
                            onChange={(e) => setEditProtein(e.target.value)}
                            className={`w-20 ${inputClass}`}
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-white">{item.proteinPer100g}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.1}
                            value={editFat}
                            onChange={(e) => setEditFat(e.target.value)}
                            className={`w-20 ${inputClass}`}
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-white">{item.fatPer100g}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.1}
                            value={editCarbs}
                            onChange={(e) => setEditCarbs(e.target.value)}
                            className={`w-20 ${inputClass}`}
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-white">{item.carbsPer100g}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={1}
                            value={editCalories}
                            onChange={(e) => setEditCalories(e.target.value)}
                            className={`w-20 ${inputClass}`}
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-white">{Math.round(item.caloriesPer100g)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {editingId === item.id ? (
                          <span className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                            >
                              Сохранить
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg"
                            >
                              Отмена
                            </button>
                          </span>
                        ) : (
                          <span className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                              title="Редактировать"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              title="Удалить"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Страница {pagination.page} из {pagination.totalPages} ({pagination.total} блюд)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchItems(pagination.page - 1)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchItems(pagination.page + 1)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
