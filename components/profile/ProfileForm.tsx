'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ProfileFormProps {
  initialData: {
    name: string | null;
    height: number | null;
    weight: number | null;
    birthDate: string | null;
  };
}

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: initialData.name || '',
    height: initialData.height?.toString() || '',
    weight: initialData.weight?.toString() || '',
    birthDate: initialData.birthDate || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name || null,
          height: formData.height ? parseInt(formData.height, 10) : null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          birthDate: formData.birthDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Произошла ошибка при сохранении');
        setIsLoading(false);
        return;
      }

      setSuccess('Профиль успешно обновлён');
      router.refresh();
    } catch {
      setError('Произошла ошибка при сохранении');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'mt-1 block w-full min-h-[44px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white touch-manipulation';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Личные данные
        </h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md bg-green-50 dark:bg-green-900/20 p-4">
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Имя
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className={inputClass}
              placeholder="Ваше имя"
            />
          </div>

          <div>
            <label htmlFor="height" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Рост (см)
            </label>
            <input
              id="height"
              name="height"
              type="number"
              min={50}
              max={250}
              value={formData.height}
              onChange={handleChange}
              className={inputClass}
              placeholder="170"
            />
          </div>

          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Вес (кг)
            </label>
            <input
              id="weight"
              name="weight"
              type="number"
              min={20}
              max={300}
              step={0.1}
              value={formData.weight}
              onChange={handleChange}
              className={inputClass}
              placeholder="70.5"
            />
          </div>

          <div>
            <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Дата рождения (для расчёта возраста)
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={handleChange}
              className={`${inputClass} [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="min-h-[48px] px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
        >
          {isLoading ? 'Сохраняем...' : 'Сохранить изменения'}
        </button>
      </div>
    </form>
  );
}
