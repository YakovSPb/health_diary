'use client';

import DiaryHeader from '@/components/diary/DiaryHeader';
import MealBlock from '@/components/diary/MealBlock';
import { formatDateForApi, getCurrentTime, getMealNameWithOrder } from '@/lib/date-utils';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

interface FoodItem {
  id: string;
  name: string;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  weightGrams: number;
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
  totalCalories: number;
  order: number;
}

interface Meal {
  id: string;
  time: string;
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
  totalCalories: number;
  foodItems: FoodItem[];
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

export default function DiaryPage() {
  const { data: session } = useSession();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savedToMenuFoodIds, setSavedToMenuFoodIds] = useState<Set<string>>(new Set());

  const fetchMeals = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const dateStr = formatDateForApi(selectedDate);
      const response = await fetch(`/api/meals?date=${dateStr}`);
      if (response.ok) {
        const data = await response.json();
        setMeals(data.meals || []);
      }
    } catch (error) {
      console.error('Error fetching meals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, session]);

  useEffect(() => {
    if (!session) return;
    fetchMeals();
  }, [session, fetchMeals]);

  const dayTotalCalories = meals.reduce((sum, m) => sum + m.totalCalories, 0);

  const handleAddMeal = async () => {
    try {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate.toISOString(),
          time: getCurrentTime(),
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setMeals([...meals, data.meal]);
      }
    } catch (error) {
      console.error('Error creating meal:', error);
    }
  };

  const handleTimeChange = async (mealId: string, time: string) => {
    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time }),
      });
      if (response.ok) {
        const data = await response.json();
        setMeals(meals.map((m) => (m.id === mealId ? data.meal : m)));
      }
    } catch (error) {
      console.error('Error updating meal time:', error);
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm('Удалить приём пищи?')) return;
    try {
      const response = await fetch(`/api/meals/${mealId}`, { method: 'DELETE' });
      if (response.ok) {
        setMeals(meals.filter((m) => m.id !== mealId));
      }
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  };

  const handleAddFood = async (mealId: string, text: string) => {
    try {
      const trimmed = text.trim();
      if (!trimmed) return;

      const productName = extractProductName(trimmed);
      let weightGrams = extractWeightFromText(trimmed);

      let name: string;
      let carbsPer100g: number;
      let proteinPer100g: number;
      let fatPer100g: number;

      const menuRes = await fetch(
        `/api/menu?search=${encodeURIComponent(productName)}&limit=5`
      );

      if (menuRes.ok) {
        const menuData = await menuRes.json();
        const menuItems = menuData.items ?? [];
        if (menuItems.length > 0) {
          const first = menuItems[0];
          name = first.name;
          carbsPer100g = first.carbsPer100g;
          proteinPer100g = first.proteinPer100g ?? 0;
          fatPer100g = first.fatPer100g ?? 0;
        } else {
          // Не нашли в меню — запрос к parse-food (diabalance)
          const parseRes = await fetch('/api/parse-food', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: trimmed }),
          });
          if (parseRes.ok) {
            const parseData = await parseRes.json();
            const food = parseData.food ?? parseData;
            name = food.name ?? productName ?? trimmed;
            carbsPer100g = Number(food.carbsPer100g) || 0;
            proteinPer100g = Number(food.proteinPer100g) ?? 0;
            fatPer100g = Number(food.fatPer100g) ?? 0;
            if (typeof food.weightGrams === 'number' && food.weightGrams > 0) {
              weightGrams = food.weightGrams;
            }
          } else {
            name = productName || trimmed;
            carbsPer100g = 0;
            proteinPer100g = 0;
            fatPer100g = 0;
          }
        }
      } else {
        // Ошибка меню — пробуем parse-food
        const parseRes = await fetch('/api/parse-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });
        if (parseRes.ok) {
          const parseData = await parseRes.json();
          const food = parseData.food ?? parseData;
          name = food.name ?? productName ?? trimmed;
          carbsPer100g = Number(food.carbsPer100g) || 0;
          proteinPer100g = Number(food.proteinPer100g) ?? 0;
          fatPer100g = Number(food.fatPer100g) ?? 0;
          if (typeof food.weightGrams === 'number' && food.weightGrams > 0) {
            weightGrams = food.weightGrams;
          }
        } else {
          name = productName || trimmed;
          carbsPer100g = 0;
          proteinPer100g = 0;
          fatPer100g = 0;
        }
      }

      const response = await fetch(`/api/meals/${mealId}/foods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          carbsPer100g,
          proteinPer100g,
          fatPer100g,
          weightGrams,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMeals(
          meals.map((m) => {
            if (m.id === mealId) {
              return {
                ...m,
                foodItems: [...m.foodItems, data.foodItem],
                totalCarbs: m.totalCarbs + data.foodItem.totalCarbs,
                totalProtein: m.totalProtein + data.foodItem.totalProtein,
                totalFat: m.totalFat + data.foodItem.totalFat,
                totalCalories: m.totalCalories + data.foodItem.totalCalories,
              };
            }
            return m;
          })
        );
      }
    } catch (error) {
      console.error('Error adding food:', error);
      alert('Произошла ошибка при добавлении продукта');
    }
  };

  const handleUpdateFood = async (
    mealId: string,
    foodId: string,
    data: {
      name?: string;
      carbsPer100g?: number;
      proteinPer100g?: number;
      fatPer100g?: number;
      weightGrams?: number;
    }
  ) => {
    try {
      const response = await fetch(`/api/meals/${mealId}/foods/${foodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        const responseData = await response.json();
        setMeals(
          meals.map((m) => {
            if (m.id === mealId) {
              const updated = m.foodItems.map((f) =>
                f.id === foodId ? responseData.foodItem : f
              );
              const totalCarbs = updated.reduce((s, f) => s + f.totalCarbs, 0);
              const totalProtein = updated.reduce((s, f) => s + f.totalProtein, 0);
              const totalFat = updated.reduce((s, f) => s + f.totalFat, 0);
              const totalCalories = updated.reduce((s, f) => s + f.totalCalories, 0);
              return {
                ...m,
                foodItems: updated,
                totalCarbs,
                totalProtein,
                totalFat,
                totalCalories,
              };
            }
            return m;
          })
        );
      }
    } catch (error) {
      console.error('Error updating food:', error);
    }
  };

  const handleSaveToMenu = async (
    _mealId: string,
    _foodId: string,
    name: string,
    carbs: number,
    protein: number,
    fat: number
  ) => {
    try {
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          carbsPer100g: carbs,
          proteinPer100g: protein,
          fatPer100g: fat,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSavedToMenuFoodIds((prev) => new Set(prev).add(_foodId));
      }
    } catch (error) {
      console.error('Error saving to menu:', error);
    }
  };

  const handleDeleteFood = async (mealId: string, foodId: string) => {
    try {
      const response = await fetch(`/api/meals/${mealId}/foods/${foodId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMeals(
          meals.map((m) => {
            if (m.id === mealId) {
              const updated = m.foodItems.filter((f) => f.id !== foodId);
              return {
                ...m,
                foodItems: updated,
                totalCarbs: updated.reduce((s, f) => s + f.totalCarbs, 0),
                totalProtein: updated.reduce((s, f) => s + f.totalProtein, 0),
                totalFat: updated.reduce((s, f) => s + f.totalFat, 0),
                totalCalories: updated.reduce((s, f) => s + f.totalCalories, 0),
              };
            }
            return m;
          })
        );
      }
    } catch (error) {
      console.error('Error deleting food:', error);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
        <DiaryHeader
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dayTotalCalories={meals.length > 0 ? dayTotalCalories : undefined}
        />

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
          </div>
        ) : (
          <>
            {meals.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Нет приёмов пищи за этот день
                </p>
                <button
                  type="button"
                  onClick={handleAddMeal}
                  className="min-h-[48px] px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors touch-manipulation"
                >
                  Добавить первый приём пищи
                </button>
              </div>
            ) : (
              <>
                {meals.map((meal) => (
                  <MealBlock
                    key={meal.id}
                    id={meal.id}
                    time={meal.time}
                    totalCarbs={meal.totalCarbs}
                    totalProtein={meal.totalProtein}
                    totalFat={meal.totalFat}
                    totalCalories={meal.totalCalories}
                    foodItems={meal.foodItems}
                    mealName={getMealNameWithOrder(meal.time, meals)}
                    onTimeChange={handleTimeChange}
                    onAddFood={handleAddFood}
                    onUpdateFood={handleUpdateFood}
                    onDeleteFood={handleDeleteFood}
                    onDelete={handleDeleteMeal}
                    onAnalyze={() => {}}
                    savedToMenuFoodIds={savedToMenuFoodIds}
                    onSaveToMenu={handleSaveToMenu}
                  />
                ))}

                <button
                  type="button"
                  onClick={handleAddMeal}
                  className="w-full min-h-[48px] py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 transition-colors touch-manipulation"
                >
                  + Добавить приём пищи
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
