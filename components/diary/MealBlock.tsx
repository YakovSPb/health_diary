'use client';

import { useState } from 'react';
import FoodItemRow from './FoodItemRow';
import VoiceInput from './VoiceInput';

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

interface MealBlockProps {
  id: string;
  time: string;
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
  totalCalories: number;
  foodItems: FoodItem[];
  mealName: string;
  onTimeChange: (id: string, time: string) => void;
  onAddFood: (mealId: string, text: string) => void;
  onUpdateFood: (mealId: string, foodId: string, data: {
    name?: string;
    carbsPer100g?: number;
    proteinPer100g?: number;
    fatPer100g?: number;
    weightGrams?: number;
  }) => void;
  onDeleteFood: (mealId: string, foodId: string) => void;
  onDelete: (id: string) => void;
  onAnalyze: (id: string) => void;
  savedToMenuFoodIds?: Set<string>;
  onSaveToMenu?: (mealId: string, foodId: string, name: string, carbs: number, protein: number, fat: number) => void;
}

export default function MealBlock({
  id,
  time: initialTime,
  totalCarbs,
  totalProtein,
  totalFat,
  totalCalories,
  foodItems,
  mealName,
  onTimeChange,
  onAddFood,
  onUpdateFood,
  onDeleteFood,
  onDelete,
  onAnalyze,
  savedToMenuFoodIds,
  onSaveToMenu,
}: MealBlockProps) {
  const [time, setTime] = useState(initialTime);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAddingFood, setIsAddingFood] = useState(false);

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    onTimeChange(id, newTime);
  };

  const handleAddFoodFromVoice = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsAddingFood(true);
    try {
      await onAddFood(id, trimmed);
    } finally {
      setIsAddingFood(false);
    }
  };

  const handleAnalyzeClick = async () => {
    setAnalysisResult(null);
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/meals/${id}/analyze`);
      if (!res.ok) return;
      const data = await res.json();
      setAnalysisResult(data.analysis || 'Нет данных');
    } catch {
      setAnalysisResult('Ошибка загрузки анализа');
    } finally {
      setIsAnalyzing(false);
      onAnalyze(id);
    }
  };

  const touchIconBtn =
    'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors touch-manipulation active:scale-95';

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 mb-4">
      <div className="flex gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="text-base px-3 py-2.5 sm:px-4 sm:py-2 font-semibold border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white min-h-[44px]"
          />
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            {mealName}
          </h3>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => onDelete(id)}
            className={`${touchIconBtn} text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30`}
            title="Удалить приём"
            aria-label="Удалить приём"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {foodItems.length > 0 && (
        <>
          <div className="mb-4 overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Название</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Б/100</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Ж/100</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">У/100</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Вес, г</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">ккал</th>
                  <th className="w-[5.5rem]"></th>
                </tr>
              </thead>
              <tbody>
                {foodItems.map((item) => (
                  <FoodItemRow
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    carbsPer100g={item.carbsPer100g}
                    proteinPer100g={item.proteinPer100g}
                    fatPer100g={item.fatPer100g}
                    weightGrams={item.weightGrams}
                    totalCarbs={item.totalCarbs}
                    totalProtein={item.totalProtein}
                    totalFat={item.totalFat}
                    totalCalories={item.totalCalories}
                    onUpdate={(foodId, data) => onUpdateFood(id, foodId, data)}
                    onDelete={(foodId) => onDeleteFood(id, foodId)}
                    variant="table"
                    savedToMenu={savedToMenuFoodIds?.has(item.id)}
                    onSaveToMenu={
                      onSaveToMenu
                        ? (name, carbs, protein, fat) => onSaveToMenu(id, item.id, name, carbs, protein, fat)
                        : undefined
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mb-4 md:hidden space-y-3">
            {foodItems.map((item) => (
              <FoodItemRow
                key={item.id}
                id={item.id}
                name={item.name}
                carbsPer100g={item.carbsPer100g}
                proteinPer100g={item.proteinPer100g}
                fatPer100g={item.fatPer100g}
                weightGrams={item.weightGrams}
                totalCarbs={item.totalCarbs}
                totalProtein={item.totalProtein}
                totalFat={item.totalFat}
                totalCalories={item.totalCalories}
                onUpdate={(foodId, data) => onUpdateFood(id, foodId, data)}
                onDelete={(foodId) => onDeleteFood(id, foodId)}
                variant="card"
                savedToMenu={savedToMenuFoodIds?.has(item.id)}
                onSaveToMenu={
                  onSaveToMenu
                    ? (name, carbs, protein, fat) => onSaveToMenu(id, item.id, name, carbs, protein, fat)
                    : undefined
                }
              />
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center border-t border-gray-200 dark:border-gray-700 pt-4">
        <VoiceInput onResult={handleAddFoodFromVoice} disabled={isAddingFood} />
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {foodItems.length > 0 && (
            <div className="flex items-center gap-2 text-sm sm:text-base">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                Б: {totalProtein.toFixed(0)} · Ж: {totalFat.toFixed(0)} · У: {totalCarbs.toFixed(0)} · {Math.round(totalCalories)} ккал
              </span>
            </div>
          )}
          {foodItems.length > 0 && (
            <button
              type="button"
              onClick={handleAnalyzeClick}
              disabled={isAnalyzing}
              className={`${touchIconBtn} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50`}
              title={isAnalyzing ? 'Анализ...' : 'Анализ приёма'}
              aria-label="Анализ приёма"
            >
              {isAnalyzing ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {analysisResult && (
        <div className="mt-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {analysisResult}
          <button
            type="button"
            onClick={() => setAnalysisResult(null)}
            className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
          >
            Скрыть
          </button>
        </div>
      )}
    </div>
  );
}
