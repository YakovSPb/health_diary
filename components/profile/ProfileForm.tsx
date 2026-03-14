'use client';

import {
  getDailyCaloriesNeeded,
  getOptimalWeight,
  getTargetCaloriesPerDay,
  SUGGESTED_CALORIE_DEFICIT,
} from '@/lib/calories';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

interface ProfileFormProps {
  initialData: {
    name: string | null;
    height: number | null;
    weight: number | null;
    birthDate: string | null;
    calorieDeficit: number | null;
    dailyCalorieNorm: number | null;
    dailyCalorieGoal: number | null;
    workouts: string | null;
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
    calorieDeficit:
      initialData.calorieDeficit != null
        ? String(initialData.calorieDeficit)
        : String(SUGGESTED_CALORIE_DEFICIT),
    dailyCalorieNorm: initialData.dailyCalorieNorm?.toString() ?? '',
    dailyCalorieGoal: initialData.dailyCalorieGoal?.toString() ?? '',
    workouts: initialData.workouts ?? '',
  });

  const [calculatedOptimalWeight, setCalculatedOptimalWeight] = useState<
    number | null
  >(
    initialData.height && initialData.height > 0
      ? getOptimalWeight(initialData.height)
      : null
  );
  const [lastWorkoutBurn, setLastWorkoutBurn] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const workoutsRef = useRef<HTMLTextAreaElement | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleCalculate = async () => {
    const height = formData.height ? parseInt(formData.height, 10) : 0;
    const weight = formData.weight ? parseFloat(formData.weight) : 0;
    const birthDate = formData.birthDate ? new Date(formData.birthDate) : null;
    const deficit = parseInt(formData.calorieDeficit, 10) || 0;
    const workoutsText =
      workoutsRef.current?.value ?? formData.workouts;

    if (height <= 0 || weight <= 0) {
      setError('Укажите рост и вес для расчёта');
      return;
    }

    const baseNorm = birthDate
      ? getDailyCaloriesNeeded(height, weight, birthDate)
      : null;
    if (baseNorm == null) {
      setError('Укажите дату рождения для расчёта нормы калорий');
      return;
    }

    setError('');
    setIsCalculating(true);
    let workoutBurn = 0;
    if (workoutsText.trim()) {
      try {
        const res = await fetch('/api/profile/estimate-workout-calories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workouts: workoutsText }),
        });
        const data = await res.json();
        if (res.ok && typeof data.caloriesPerDay === 'number') {
          workoutBurn = data.caloriesPerDay;
        }
      } catch {
        setError('Не удалось оценить калории по тренировкам. Проверьте DEEPSEEK_API_KEY.');
      }
    }
    setIsCalculating(false);

    setCalculatedOptimalWeight(getOptimalWeight(height));
    setLastWorkoutBurn(workoutBurn);
    const normWithWorkouts = baseNorm + workoutBurn;
    const goal = getTargetCaloriesPerDay(normWithWorkouts, deficit);

    setFormData((prev) => ({
      ...prev,
      dailyCalorieNorm: String(normWithWorkouts),
      dailyCalorieGoal: String(goal),
    }));
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
          calorieDeficit: formData.calorieDeficit
            ? parseInt(formData.calorieDeficit, 10)
            : null,
          dailyCalorieNorm: formData.dailyCalorieNorm
            ? parseInt(formData.dailyCalorieNorm, 10)
            : null,
          dailyCalorieGoal: formData.dailyCalorieGoal
            ? parseInt(formData.dailyCalorieGoal, 10)
            : null,
          workouts: formData.workouts.trim() || null,
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

          <div>
            <label htmlFor="calorieDeficit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Дефицит калорий (ккал/день)
            </label>
            <input
              id="calorieDeficit"
              name="calorieDeficit"
              type="number"
              min={0}
              max={2000}
              value={formData.calorieDeficit}
              onChange={handleChange}
              className={inputClass}
              placeholder={String(SUGGESTED_CALORIE_DEFICIT)}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Для похудения ~0,5 кг/нед обычно 400–500 ккал
            </p>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="workouts"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Тренировки
            </label>
            <textarea
              ref={workoutsRef}
              id="workouts"
              name="workouts"
              value={formData.workouts}
              onChange={handleChange}
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder="Например: бег 300 ккал, силовая 200 ккал — числа учтутся при нажатии «Рассчитать»"
            />
          </div>
        </div>

        <div className="mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Расчёт при сохранении
          </h3>
          {formData.height && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Оптимальный вес (ИМТ 21,5):{' '}
              {calculatedOptimalWeight ??
                getOptimalWeight(parseInt(formData.height, 10) || 0)}{' '}
              кг
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="dailyCalorieNorm"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Норма ккал/день
              </label>
              <input
                id="dailyCalorieNorm"
                name="dailyCalorieNorm"
                type="number"
                min={0}
                max={10000}
                value={formData.dailyCalorieNorm}
                onChange={handleChange}
                className={inputClass}
                placeholder="2620"
              />
            </div>
            <div>
              <label
                htmlFor="dailyCalorieGoal"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Цель в день (ккал)
              </label>
              <input
                id="dailyCalorieGoal"
                name="dailyCalorieGoal"
                type="number"
                min={0}
                max={10000}
                value={formData.dailyCalorieGoal}
                onChange={handleChange}
                className={inputClass}
                placeholder="2320"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={isCalculating}
              className="min-h-[44px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {isCalculating ? 'Считаем…' : 'Рассчитать'}
            </button>
            {lastWorkoutBurn !== null && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Учтено от тренировок: {lastWorkoutBurn} ккал/день
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={isLoading}
          className="min-h-[48px] px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
        >
          {isLoading ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}
