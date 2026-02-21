'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TokenItem {
  id: string;
  label: string | null;
  createdAt: string;
}

export default function WearableTokens() {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wearable/token');
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens ?? []);
      }
    } catch {
      setError('Не удалось загрузить список токенов');
    } finally {
      setLoading(false);
    }
  }, []);

  const createToken = useCallback(async () => {
    setCreating(true);
    setError(null);
    setNewToken(null);
    try {
      const res = await fetch('/api/wearable/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newTokenLabel || 'Samsung Watch' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Ошибка создания токена');
        return;
      }
      setNewToken(data.token);
      setNewTokenLabel('');
      fetchTokens();
    } catch {
      setError('Ошибка создания токена');
    } finally {
      setCreating(false);
    }
  }, [newTokenLabel, fetchTokens]);

  const revokeToken = useCallback(
    async (id: string) => {
      if (!confirm('Отозвать этот токен? Приложение, использующее его, больше не сможет отправлять данные.')) return;
      try {
        const res = await fetch(`/api/wearable/token?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) fetchTokens();
      } catch {
        setError('Не удалось отозвать токен');
      }
    },
    [fetchTokens]
  );

  const copyToken = useCallback(() => {
    if (newToken) void navigator.clipboard.writeText(newToken);
  }, [newToken]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Подключение часов
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Токен нужен для приложения на телефоне, которое отправляет данные с Samsung Watch в Мой доктор. Создайте токен и введите его в приложении.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {newToken && (
        <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
            Сохраните токен — он больше не будет показан
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 break-all text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">
              {newToken}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700"
            >
              Копировать
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={createToken}
          disabled={creating}
          className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Создаём…' : 'Создать токен'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Нет созданных токенов.</p>
      ) : (
        <ul className="space-y-2">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t.label ?? 'Токен'} — создан {format(new Date(t.createdAt), 'd MMM yyyy', { locale: ru })}
              </span>
              <button
                type="button"
                onClick={() => revokeToken(t.id)}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Отозвать
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
