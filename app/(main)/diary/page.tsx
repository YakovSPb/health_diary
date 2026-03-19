'use client';

import DiaryDayCalories from '@/components/diary/DiaryDayCalories';
import DiaryHeader from '@/components/diary/DiaryHeader';
import MealBlock from '@/components/diary/MealBlock';
import { getTargetCaloriesPerDay } from '@/lib/calories';
import { formatDateForApi, getCurrentTime, getMealNameWithOrder, isMealWithin30Minutes } from '@/lib/date-utils';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface FoodItem {
  id: string;
  name: string;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  sugarsPer100g?: number | null;
  weightGrams: number;
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
  totalCalories: number;
  order: number;
  /** ID пункта меню, если продукт добавлен из меню */
  menuItemId?: string | null;
  /** Продукт сохранён в меню (приходит с API после перезагрузки) */
  savedToMenu?: boolean;
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

interface ProfileCalories {
  dailyCaloriesNeeded: number | null;
  calorieDeficit: number | null;
  /** Явно заданная цель ккал/день из профиля; при наличии используется вместо расчёта норма − дефицит */
  dailyCalorieGoal: number | null;
}

export default function DiaryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savedToMenuFoodIds, setSavedToMenuFoodIds] = useState<Set<string>>(new Set());
  /** ID продуктов, добавленных из меню в этой сессии (для зелёной точки «из меню») */
  const [foodIdsFromMenu, setFoodIdsFromMenu] = useState<Set<string>>(new Set());
  const [profileCalories, setProfileCalories] = useState<ProfileCalories | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfileCalories({
          dailyCaloriesNeeded: data.dailyCaloriesNeeded ?? null,
          calorieDeficit: data.calorieDeficit ?? null,
          dailyCalorieGoal: data.dailyCalorieGoal ?? null,
        });
      }
    } catch {
      setProfileCalories(null);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchProfile();
  }, [session, fetchProfile]);

  const targetCaloriesPerDay =
    profileCalories?.dailyCalorieGoal != null && profileCalories.dailyCalorieGoal > 0
      ? profileCalories.dailyCalorieGoal
      : profileCalories?.dailyCaloriesNeeded != null &&
          profileCalories?.calorieDeficit != null
        ? getTargetCaloriesPerDay(
            profileCalories.dailyCaloriesNeeded,
            profileCalories.calorieDeficit
          )
        : null;

  const fetchMeals = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const dateStr = formatDateForApi(selectedDate);
      const response = await fetch(`/api/meals?date=${dateStr}`);
      if (response.ok) {
        const data = await response.json();
        const loadedMeals: Meal[] = data.meals || [];
        setMeals(loadedMeals);
        const savedIds = new Set(
          loadedMeals.flatMap((m) =>
            m.foodItems.filter((f) => f.savedToMenu).map((f) => f.id)
          )
        );
        setSavedToMenuFoodIds(savedIds);
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
    const meal = meals.find((m) => m.id === mealId);
    const isEmpty = !meal || meal.foodItems.length === 0;
    if (!isEmpty && !confirm('Удалить приём пищи?')) return;
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
      let sugarsPer100g: number | undefined;
      let menuItemId: string | undefined;

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
          sugarsPer100g = first.hasSugar ? 1 : undefined;
          menuItemId = first.id;
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
            const s = Number(food.sugarsPer100g);
            sugarsPer100g = Number.isNaN(s) ? undefined : Math.max(0, s);
            if (typeof food.weightGrams === 'number' && food.weightGrams > 0) {
              weightGrams = food.weightGrams;
            }
          } else {
            name = productName || trimmed;
            carbsPer100g = 0;
            proteinPer100g = 0;
            fatPer100g = 0;
            sugarsPer100g = undefined;
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
          const s = Number(food.sugarsPer100g);
          sugarsPer100g = Number.isNaN(s) ? undefined : Math.max(0, s);
          if (typeof food.weightGrams === 'number' && food.weightGrams > 0) {
            weightGrams = food.weightGrams;
          }
        } else {
          name = productName || trimmed;
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
        ...(sugarsPer100g !== undefined && { sugarsPer100g }),
        weightGrams,
      };
      if (menuItemId) body.menuItemId = menuItemId;

      const response = await fetch(`/api/meals/${mealId}/foods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        const newItem = data.foodItem as FoodItem;
        const added: FoodItem = {
          ...newItem,
          menuItemId: newItem.menuItemId ?? menuItemId ?? null,
        };
        if (menuItemId) {
          setFoodIdsFromMenu((prev) => new Set(prev).add(added.id));
        }
        setMeals(
          meals.map((m) => {
            if (m.id === mealId) {
              return {
                ...m,
                foodItems: [...m.foodItems, added],
                totalCarbs: m.totalCarbs + added.totalCarbs,
                totalProtein: m.totalProtein + added.totalProtein,
                totalFat: m.totalFat + added.totalFat,
                totalCalories: m.totalCalories + added.totalCalories,
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

  const handleAddFoodByPhoto = async (mealId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const parseResponse = await fetch('/api/parse-food-image', {
        method: 'POST',
        body: formData,
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({}));
        const detail = (errorData?.message as string) || (errorData?.error as string);
        const message =
          detail ||
          (parseResponse.status === 415
            ? 'Неверный формат изображения'
            : 'Не удалось распознать еду по фото');
        alert(message);
        return;
      }

      const parseData = await parseResponse.json();
      const food = parseData.food as {
        name: string;
        carbsPer100g: number;
        weightGrams: number;
        proteinPer100g?: number;
        fatPer100g?: number;
        sugarsPer100g?: number;
        menuItemId?: string;
      };

      const body: Record<string, unknown> = {
        name: food.name,
        carbsPer100g: food.carbsPer100g,
        proteinPer100g: food.proteinPer100g ?? 0,
        fatPer100g: food.fatPer100g ?? 0,
        weightGrams: food.weightGrams,
      };
      if (food.menuItemId) body.menuItemId = food.menuItemId;
      if (food.sugarsPer100g !== undefined)
        body.sugarsPer100g = food.sugarsPer100g;

      const response = await fetch(`/api/meals/${mealId}/foods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        alert('Не удалось добавить продукт по фото');
        return;
      }

      const data = await response.json();
      const newItem = data.foodItem as FoodItem;
      if (newItem.menuItemId) {
        setFoodIdsFromMenu((prev) => new Set(prev).add(newItem.id));
      }
      setMeals((prev) =>
        prev.map((m) => {
          if (m.id !== mealId) return m;
          return {
            ...m,
            foodItems: [...m.foodItems, { ...newItem, menuItemId: newItem.menuItemId ?? null }],
            totalCarbs: m.totalCarbs + newItem.totalCarbs,
            totalProtein: m.totalProtein + newItem.totalProtein,
            totalFat: m.totalFat + newItem.totalFat,
            totalCalories: m.totalCalories + newItem.totalCalories,
          };
        })
      );
    } catch (error) {
      console.error('Error adding food by photo:', error);
      alert('Произошла ошибка при добавлении по фото');
    }
  };

  const handleAddFoodByBarcode = async (mealId: string, barcode: string) => {
    try {
      const trimmed = barcode.trim();
      if (!trimmed) return;

      const parseResponse = await fetch('/api/parse-food-barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: trimmed }),
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json().catch(() => ({}));
        const message =
          (errorData?.error as string) ||
          (parseResponse.status === 404
            ? 'Продукт по этому штрихкоду не найден'
            : 'Не удалось получить данные по штрихкоду');
        alert(message);
        return;
      }

      const parseData = await parseResponse.json();
      const food = parseData.food as {
        name: string;
        carbsPer100g: number;
        weightGrams: number;
        proteinPer100g?: number;
        fatPer100g?: number;
        menuItemId?: string;
      };

      const body: Record<string, unknown> = {
        name: food.name,
        carbsPer100g: food.carbsPer100g,
        proteinPer100g: food.proteinPer100g ?? 0,
        fatPer100g: food.fatPer100g ?? 0,
        weightGrams: food.weightGrams,
      };
      if (food.menuItemId) body.menuItemId = food.menuItemId;

      const response = await fetch(`/api/meals/${mealId}/foods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        alert('Не удалось добавить продукт по штрихкоду');
        return;
      }

      const data = await response.json();
      const newItem = data.foodItem as FoodItem;
      if (newItem.menuItemId) {
        setFoodIdsFromMenu((prev) => new Set(prev).add(newItem.id));
      }
      setMeals((prev) =>
        prev.map((m) => {
          if (m.id !== mealId) return m;
          return {
            ...m,
            foodItems: [...m.foodItems, { ...newItem, menuItemId: newItem.menuItemId ?? null }],
            totalCarbs: m.totalCarbs + newItem.totalCarbs,
            totalProtein: m.totalProtein + newItem.totalProtein,
            totalFat: m.totalFat + newItem.totalFat,
            totalCalories: m.totalCalories + newItem.totalCalories,
          };
        })
      );
    } catch (error) {
      console.error('Error adding food by barcode:', error);
      alert('Произошла ошибка при добавлении по штрихкоду');
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
    mealId: string,
    foodId: string,
    name: string,
    carbs: number,
    protein: number,
    fat: number,
    caloriesPer100g?: number
  ) => {
    try {
      const body: Record<string, unknown> = {
        name,
        carbsPer100g: carbs,
        proteinPer100g: protein,
        fatPer100g: fat,
      };
      if (caloriesPer100g !== undefined) body.caloriesPer100g = caloriesPer100g;
      const response = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const patchRes = await fetch(`/api/meals/${mealId}/foods/${foodId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ savedToMenu: true }),
        });
        if (!patchRes.ok) {
          const errText = await patchRes.text();
          console.error('PATCH savedToMenu failed:', patchRes.status, errText);
          alert('Продукт добавлен в меню, но не удалось сохранить отметку. Перезагрузите страницу и попробуйте снова.');
          return;
        }
        setSavedToMenuFoodIds((prev) => new Set(prev).add(foodId));
        setMeals((prev) =>
          prev.map((m) =>
            m.id === mealId
              ? {
                  ...m,
                  foodItems: m.foodItems.map((f) =>
                    f.id === foodId ? { ...f, savedToMenu: true } : f
                  ),
                }
              : m
          )
        );
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
        />

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
          </div>
        ) : (
          <>
            {meals.length === 0 ? (
              <>
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
                <DiaryDayCalories
                  dayTotalCalories={0}
                  targetCaloriesPerDay={targetCaloriesPerDay}
                />
              </>
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
                    onAddFoodByBarcode={handleAddFoodByBarcode}
                    onAddFoodByPhoto={handleAddFoodByPhoto}
                    onUpdateFood={handleUpdateFood}
                    onDeleteFood={handleDeleteFood}
                    onDelete={handleDeleteMeal}
                    savedToMenuFoodIds={savedToMenuFoodIds}
                    foodIdsFromMenu={foodIdsFromMenu}
                    onSaveToMenu={handleSaveToMenu}
                    defaultExpanded={isMealWithin30Minutes(selectedDate, meal.time)}
                    onOpenManualSearch={() => {
                      const date = formatDateForApi(selectedDate);
                      router.push(`/diary/search?date=${encodeURIComponent(date)}`);
                    }}
                  />
                ))}

                <button
                  type="button"
                  onClick={handleAddMeal}
                  className="w-full min-h-[48px] py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 transition-colors touch-manipulation"
                >
                  + Добавить приём пищи
                </button>

                <DiaryDayCalories
                  dayTotalCalories={dayTotalCalories}
                  targetCaloriesPerDay={targetCaloriesPerDay}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
