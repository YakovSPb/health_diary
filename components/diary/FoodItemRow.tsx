'use client';

import { useEffect, useState } from 'react';
import { caloriesFromBju } from '@/lib/date-utils';

interface FoodItemRowProps {
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
  onUpdate: (id: string, data: {
    name?: string;
    carbsPer100g?: number;
    proteinPer100g?: number;
    fatPer100g?: number;
    weightGrams?: number;
  }) => void;
  onDelete: (id: string) => void;
  variant?: 'table' | 'card';
  savedToMenu?: boolean;
  onSaveToMenu?: (name: string, carbs: number, protein: number, fat: number) => void;
}

const inputBase =
  'bg-transparent border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 text-gray-900 dark:text-white text-base touch-manipulation min-h-[34px]';

export default function FoodItemRow({
  id,
  name: initialName,
  carbsPer100g: initialCarbs,
  proteinPer100g: initialProtein,
  fatPer100g: initialFat,
  weightGrams: initialWeight,
  totalCarbs,
  totalProtein,
  totalFat,
  totalCalories,
  onUpdate,
  onDelete,
  variant = 'table',
  savedToMenu = false,
  onSaveToMenu,
}: FoodItemRowProps) {
  const [name, setName] = useState(initialName);
  const [carbsPer100g, setCarbsPer100g] = useState(initialCarbs.toString());
  const [proteinPer100g, setProteinPer100g] = useState(initialProtein.toString());
  const [fatPer100g, setFatPer100g] = useState(initialFat.toString());
  const [weightGrams, setWeightGrams] = useState(initialWeight.toString());
  const [isEditing, setIsEditing] = useState(false);
  const [baselineMenu, setBaselineMenu] = useState(() => ({
    name: initialName,
    carbs: initialCarbs,
    protein: initialProtein,
    fat: initialFat,
  }));

  const carbsNum = parseFloat(carbsPer100g);
  const proteinNum = parseFloat(proteinPer100g);
  const fatNum = parseFloat(fatPer100g);
  const hasValidBju = !Number.isNaN(carbsNum) && !Number.isNaN(proteinNum) && !Number.isNaN(fatNum);
  const hasChangesForMenu =
    onSaveToMenu &&
    (name.trim() !== baselineMenu.name ||
      (hasValidBju && (carbsNum !== baselineMenu.carbs || proteinNum !== baselineMenu.protein || fatNum !== baselineMenu.fat)));

  const handleSaveToMenu = () => {
    if (!onSaveToMenu || !hasValidBju) return;
    onSaveToMenu(name.trim(), carbsNum, proteinNum, fatNum);
    setBaselineMenu({ name: name.trim(), carbs: carbsNum, protein: proteinNum, fat: fatNum });
    const weightNum = parseFloat(weightGrams);
    const updates: Parameters<typeof onUpdate>[1] = {
      name: name.trim(),
      carbsPer100g: carbsNum,
      proteinPer100g: proteinNum,
      fatPer100g: fatNum,
    };
    if (!Number.isNaN(weightNum) && weightNum >= 0) updates.weightGrams = weightNum;
    onUpdate(id, updates);
  };

  useEffect(() => {
    if (!isEditing) return;
    const timer = setTimeout(() => {
      const updates: Parameters<typeof onUpdate>[1] = {};
      if (name !== initialName) updates.name = name;
      if (!Number.isNaN(carbsNum) && carbsNum !== initialCarbs) updates.carbsPer100g = carbsNum;
      if (!Number.isNaN(proteinNum) && proteinNum !== initialProtein) updates.proteinPer100g = proteinNum;
      if (!Number.isNaN(fatNum) && fatNum !== initialFat) updates.fatPer100g = fatNum;
      const weightNum = parseFloat(weightGrams);
      if (!Number.isNaN(weightNum) && weightNum !== initialWeight) updates.weightGrams = weightNum;
      if (Object.keys(updates).length > 0) onUpdate(id, updates);
    }, 1000);
    return () => clearTimeout(timer);
  }, [name, carbsPer100g, proteinPer100g, fatPer100g, weightGrams, isEditing, initialName, initialCarbs, initialProtein, initialFat, initialWeight, id, onUpdate]);

  const saveOnBlur = () => {
    const updates: Parameters<typeof onUpdate>[1] = {};
    if (name !== initialName) updates.name = name;
    if (!Number.isNaN(carbsNum) && carbsNum !== initialCarbs) updates.carbsPer100g = carbsNum;
    if (!Number.isNaN(proteinNum) && proteinNum !== initialProtein) updates.proteinPer100g = proteinNum;
    if (!Number.isNaN(fatNum) && fatNum !== initialFat) updates.fatPer100g = fatNum;
    const weightNum = parseFloat(weightGrams);
    if (!Number.isNaN(weightNum) && weightNum !== initialWeight) updates.weightGrams = weightNum;
    if (Object.keys(updates).length > 0) onUpdate(id, updates);
    setIsEditing(false);
  };

  const deleteBtn = (
    <button
      type="button"
      onClick={() => onDelete(id)}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
      aria-label="Удалить продукт"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );

  const saveToMenuBtn = hasChangesForMenu ? (
    <button
      type="button"
      onClick={handleSaveToMenu}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg"
      aria-label="Сохранить в меню"
      title="Сохранить в меню"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
    </button>
  ) : savedToMenu && onSaveToMenu ? (
    <span className="min-h-[44px] min-w-[44px] flex items-center justify-center text-green-600" title="Сохранено в меню">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : null;

  if (variant === 'card') {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
        <div className="flex gap-2 items-start justify-between">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setIsEditing(true)}
            onBlur={saveOnBlur}
            className={`flex-1 min-w-0 ${inputBase}`}
            placeholder="Название"
          />
          <div className="flex items-center gap-1 shrink-0">
            {saveToMenuBtn}
            {deleteBtn}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Б, г/100</label>
            <input
              type="number"
              inputMode="decimal"
              value={proteinPer100g}
              onChange={(e) => setProteinPer100g(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={saveOnBlur}
              min={0}
              step={0.1}
              className={`w-full ${inputBase}`}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Ж, г/100</label>
            <input
              type="number"
              inputMode="decimal"
              value={fatPer100g}
              onChange={(e) => setFatPer100g(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={saveOnBlur}
              min={0}
              step={0.1}
              className={`w-full ${inputBase}`}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">У, г/100</label>
            <input
              type="number"
              inputMode="decimal"
              value={carbsPer100g}
              onChange={(e) => setCarbsPer100g(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={saveOnBlur}
              min={0}
              step={0.1}
              className={`w-full ${inputBase}`}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Вес, г</label>
            <input
              type="number"
              inputMode="numeric"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={saveOnBlur}
              min={0}
              step={1}
              className={`w-full ${inputBase}`}
            />
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          К/100: {Math.round(caloriesFromBju(proteinNum, carbsNum, fatNum))} · ккал: {Math.round(totalCalories)}
        </p>
      </div>
    );
  }

  return (
    <tr className="border-t border-gray-200 dark:border-gray-700">
      <td className="py-3 px-2 sm:px-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={saveOnBlur}
          className="w-full min-w-0 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1.5 text-base text-gray-900 dark:text-white min-h-[44px]"
          placeholder="Название"
        />
      </td>
      <td className="py-3 px-2 sm:px-4">
        <input
          type="number"
          inputMode="decimal"
          value={proteinPer100g}
          onChange={(e) => setProteinPer100g(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={saveOnBlur}
          min={0}
          step={0.1}
          className="w-16 sm:w-20 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1.5 text-gray-900 dark:text-white min-h-[44px]"
        />
      </td>
      <td className="py-3 px-2 sm:px-4">
        <input
          type="number"
          inputMode="decimal"
          value={fatPer100g}
          onChange={(e) => setFatPer100g(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={saveOnBlur}
          min={0}
          step={0.1}
          className="w-16 sm:w-20 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1.5 text-gray-900 dark:text-white min-h-[44px]"
        />
      </td>
      <td className="py-3 px-2 sm:px-4">
        <input
          type="number"
          inputMode="decimal"
          value={carbsPer100g}
          onChange={(e) => setCarbsPer100g(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={saveOnBlur}
          min={0}
          step={0.1}
          className="w-16 sm:w-20 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1.5 text-gray-900 dark:text-white min-h-[44px]"
        />
      </td>
      <td className="py-3 px-2 sm:px-4">
        <input
          type="number"
          inputMode="numeric"
          value={weightGrams}
          onChange={(e) => setWeightGrams(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={saveOnBlur}
          min={0}
          step={1}
          className="w-16 sm:w-20 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1.5 text-gray-900 dark:text-white min-h-[44px]"
        />
      </td>
      <td className="py-3 px-2 sm:px-4 text-gray-900 dark:text-white text-sm">
        {Math.round(caloriesFromBju(proteinNum, carbsNum, fatNum))}
      </td>
      <td className="py-3 px-2 sm:px-4 text-gray-900 dark:text-white font-semibold text-sm">
        {Math.round(totalCalories)}
      </td>
      <td className="py-3 px-2 sm:pl-4 pr-0 text-right">
        <div className="flex items-center justify-end gap-1">
          {saveToMenuBtn}
          {deleteBtn}
        </div>
      </td>
    </tr>
  );
}
