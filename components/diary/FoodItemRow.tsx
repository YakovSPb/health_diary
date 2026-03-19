'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /** true, если продукт добавлен из меню (зелёный кружок слева от названия) */
  fromMenu?: boolean;
  savedToMenu?: boolean;
  onSaveToMenu?: (name: string, carbs: number, protein: number, fat: number, caloriesPer100g?: number) => void;
  /** Если true, название отображается красным (продукт содержит сахар по данным DeepSeek). */
  hasSugar?: boolean;
}

const inputBase =
  'bg-transparent border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2 text-gray-900 dark:text-white text-base touch-manipulation min-h-[34px]';
const compactCardInput = `${inputBase} px-2 py-1 text-sm min-h-[30px] rounded-md`;
const compactCardLabel = 'block text-[10px] leading-tight text-gray-500 dark:text-gray-400 mb-0.5';

type WeightCalcOp = '+' | '-' | '*' | '/';

function applyWeightOp(current: number, op: WeightCalcOp, value: number): number {
  switch (op) {
    case '+':
      return current + value;
    case '-':
      return Math.max(0, current - value);
    case '*':
      return current * value;
    case '/':
      return value !== 0 ? current / value : current;
    default:
      return current;
  }
}

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
   fromMenu = false,
  savedToMenu = false,
  onSaveToMenu,
  hasSugar = false,
}: FoodItemRowProps) {
  const nameInputClass = 'text-gray-900 dark:text-white';
  const [name, setName] = useState(initialName);
  const [carbsPer100g, setCarbsPer100g] = useState(initialCarbs.toString());
  const [proteinPer100g, setProteinPer100g] = useState(initialProtein.toString());
  const [fatPer100g, setFatPer100g] = useState(initialFat.toString());
  const [weightGrams, setWeightGrams] = useState(initialWeight.toString());
  const [isEditing, setIsEditing] = useState(false);
  const [weightCalcOpen, setWeightCalcOpen] = useState(false);
  const [weightCalcOp, setWeightCalcOp] = useState<WeightCalcOp>('+');
  const [weightCalcInput, setWeightCalcInput] = useState('');
  const initialCaloriesPer100 =
    !Number.isNaN(initialCarbs) &&
    !Number.isNaN(initialProtein) &&
    !Number.isNaN(initialFat)
      ? Math.round(caloriesFromBju(initialProtein, initialCarbs, initialFat))
      : 0;
  const [baselineMenu, setBaselineMenu] = useState(() => ({
    name: initialName,
    carbs: initialCarbs,
    protein: initialProtein,
    fat: initialFat,
    caloriesPer100: initialCaloriesPer100,
  }));

  const carbsNum = parseFloat(carbsPer100g);
  const proteinNum = parseFloat(proteinPer100g);
  const fatNum = parseFloat(fatPer100g);
  const hasValidBju = !Number.isNaN(carbsNum) && !Number.isNaN(proteinNum) && !Number.isNaN(fatNum);
  const [caloriesPer100Input, setCaloriesPer100Input] = useState(
    hasValidBju ? Math.round(caloriesFromBju(proteinNum, carbsNum, fatNum)).toString() : ''
  );
  const caloriesPer100Num = parseFloat(caloriesPer100Input);
  const weightNumForCalories = parseFloat(weightGrams);
  const displayCalories =
    !Number.isNaN(caloriesPer100Num) && !Number.isNaN(weightNumForCalories)
      ? (caloriesPer100Num * weightNumForCalories) / 100
      : totalCalories;

  const displayTotalCarbs =
    !Number.isNaN(carbsNum) && !Number.isNaN(weightNumForCalories)
      ? (carbsNum * weightNumForCalories) / 100
      : totalCarbs;
  const displayTotalProtein =
    !Number.isNaN(proteinNum) && !Number.isNaN(weightNumForCalories)
      ? (proteinNum * weightNumForCalories) / 100
      : totalProtein;
  const displayTotalFat =
    !Number.isNaN(fatNum) && !Number.isNaN(weightNumForCalories)
      ? (fatNum * weightNumForCalories) / 100
      : totalFat;
  const caloriesChanged =
    !Number.isNaN(caloriesPer100Num) &&
    Math.round(caloriesPer100Num) !== baselineMenu.caloriesPer100;
  const hasChangesForMenu =
    onSaveToMenu &&
    (name.trim() !== baselineMenu.name ||
      (hasValidBju && (carbsNum !== baselineMenu.carbs || proteinNum !== baselineMenu.protein || fatNum !== baselineMenu.fat)) ||
      caloriesChanged);

  const handleSaveToMenu = () => {
    if (!onSaveToMenu || !hasValidBju) return;
    const cal = !Number.isNaN(caloriesPer100Num) ? Math.round(caloriesPer100Num) : undefined;
    onSaveToMenu(name.trim(), carbsNum, proteinNum, fatNum, cal);
    setBaselineMenu({
      name: name.trim(),
      carbs: carbsNum,
      protein: proteinNum,
      fat: fatNum,
      caloriesPer100: cal ?? Math.round(caloriesFromBju(proteinNum, carbsNum, fatNum)),
    });
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

  const handleCaloriesPer100Change = (value: string) => {
    setIsEditing(true);
    setCaloriesPer100Input(value);
  };

  const openWeightCalc = () => {
    setWeightCalcOp('+');
    setWeightCalcInput('');
    setWeightCalcOpen(true);
  };

  const applyWeightCalc = () => {
    const value = parseFloat(weightCalcInput.replace(',', '.'));
    if (Number.isNaN(value)) return;
    const current = parseFloat(weightGrams) || 0;
    const newWeight = Math.round(applyWeightOp(current, weightCalcOp, value) * 10) / 10;
    const clamped = Math.max(0, newWeight);
    setWeightGrams(clamped.toString());
    onUpdate(id, { weightGrams: clamped });
    setWeightCalcOpen(false);
  };

  const weightCalcPopover = weightCalcOpen && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setWeightCalcOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Калькулятор веса"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 w-full max-w-[280px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Изменить вес</p>
        <div className="flex gap-2 mb-3">
          {(['+', '-', '*', '/'] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setWeightCalcOp(op)}
              className={`flex-1 min-h-[44px] rounded-lg font-medium transition-colors touch-manipulation ${
                weightCalcOp === op
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        <input
          type="number"
          inputMode="decimal"
          value={weightCalcInput}
          onChange={(e) => setWeightCalcInput(e.target.value)}
          placeholder="Число"
          className={`w-full ${inputBase} mb-3`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyWeightCalc();
            if (e.key === 'Escape') setWeightCalcOpen(false);
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWeightCalcOpen(false)}
            className="flex-1 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 touch-manipulation"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={applyWeightCalc}
            className="flex-1 min-h-[44px] rounded-lg bg-blue-600 text-white hover:bg-blue-700 touch-manipulation"
          >
            ОК
          </button>
        </div>
      </div>
    </div>
  );

  if (variant === 'card') {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 space-y-2">
        <div className="flex gap-1.5 items-start justify-between">
          <div className="flex gap-2 flex-1 min-w-0 items-start">
            {(fromMenu || savedToMenu) && (
              <span
                className="shrink-0 w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-400 mt-[0.6rem]"
                title={fromMenu ? 'Из меню' : 'Сохранено в меню'}
                aria-hidden
              />
            )}
            <textarea
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={saveOnBlur}
              className={`flex-1 min-w-0 ${compactCardInput} ${nameInputClass} resize-none leading-snug`}
              placeholder="Название"
              rows={1}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {saveToMenuBtn}
            {deleteBtn}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label className={compactCardLabel}>Б/100</label>
            <input
              type="number"
              inputMode="decimal"
              value={proteinPer100g}
              onChange={(e) => setProteinPer100g(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={saveOnBlur}
              min={0}
              step={0.1}
              className={`w-full ${compactCardInput}`}
            />
          </div>
          <div>
            <label className={compactCardLabel}>Ж/100</label>
            <input
              type="number"
              inputMode="decimal"
              value={fatPer100g}
              onChange={(e) => setFatPer100g(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={saveOnBlur}
              min={0}
              step={0.1}
              className={`w-full ${compactCardInput}`}
            />
          </div>
          <div>
            <label className={compactCardLabel}>У/100</label>
            <input
              type="number"
              inputMode="decimal"
              value={carbsPer100g}
              onChange={(e) => setCarbsPer100g(e.target.value)}
              onFocus={() => setIsEditing(true)}
              onBlur={saveOnBlur}
              min={0}
              step={0.1}
              className={`w-full ${compactCardInput}`}
            />
          </div>
          <div>
            <label className={compactCardLabel}>К/100</label>
            <input
              type="number"
              inputMode="decimal"
              value={caloriesPer100Input}
              onChange={(e) => handleCaloriesPer100Change(e.target.value)}
              className={`w-full ${compactCardInput}`}
              min={0}
              step={1}
            />
          </div>
          <div className="min-w-0">
            <label className={compactCardLabel}>Вес, г</label>
            <div className="flex items-center gap-1 min-w-0">
              <input
                type="number"
                inputMode="numeric"
                value={weightGrams}
                onChange={(e) => setWeightGrams(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={saveOnBlur}
                min={0}
                step={1}
                className={`w-full min-w-0 ${compactCardInput}`}
              />
              <button
                type="button"
                onClick={openWeightCalc}
                className="min-h-[28px] min-w-[28px] h-7 w-7 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md border border-gray-200 dark:border-gray-600 transition-colors touch-manipulation active:scale-95 shrink-0"
                aria-label="Калькулятор веса"
                title="Изменить вес (+ − × ÷)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-900 dark:text-white">
          <span className="text-gray-700 dark:text-gray-300 truncate">
            Б:{displayTotalProtein.toFixed(0)} Ж:{displayTotalFat.toFixed(0)} У:{displayTotalCarbs.toFixed(0)}
          </span>
          <span className="shrink-0">· ккал: {Math.round(displayCalories)}</span>
        </div>
        {weightCalcPopover}
      </div>
    );
  }

  return (
    <>
      <tr className="border-t border-gray-200 dark:border-gray-700">
      <td className="py-3 px-2 sm:px-4 align-top">
        <div className="flex gap-2 items-center min-w-0">
          {(fromMenu || savedToMenu) && (
            <span
              className="shrink-0 w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-400"
              title={fromMenu ? 'Из меню' : 'Сохранено в меню'}
              aria-hidden
            />
          )}
          <textarea
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setIsEditing(true)}
            onBlur={saveOnBlur}
            className={`w-full min-w-0 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1.5 text-base min-h-[44px] ${nameInputClass} resize-none leading-snug`}
            placeholder="Название"
            rows={2}
          />
        </div>
        <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Б:{displayTotalProtein.toFixed(0)} Ж:{displayTotalFat.toFixed(0)} У:{displayTotalCarbs.toFixed(0)}
        </div>
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
          <div className="flex items-center gap-1">
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
            <button
              type="button"
              onClick={openWeightCalc}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors touch-manipulation active:scale-95 shrink-0"
              aria-label="Калькулятор веса"
              title="Изменить вес (+ − × ÷)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </td>
      <td className="py-3 px-2 sm:px-4 text-gray-900 dark:text-white text-sm">
        <input
          type="number"
          inputMode="decimal"
          value={caloriesPer100Input}
          onChange={(e) => handleCaloriesPer100Change(e.target.value)}
          min={0}
          step={1}
          className="w-16 sm:w-20 bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1.5 text-gray-900 dark:text-white min-h-[44px]"
        />
      </td>
      <td className="py-3 px-2 sm:px-4 text-gray-900 dark:text-white font-semibold text-sm">
        {Math.round(displayCalories)}
      </td>
      <td className="py-3 px-2 sm:pl-4 pr-0 text-right">
        <div className="flex items-center justify-end gap-1">
          {saveToMenuBtn}
          {deleteBtn}
        </div>
      </td>
      </tr>
      {weightCalcOpen &&
        typeof document !== 'undefined' &&
        createPortal(weightCalcPopover, document.body)}
    </>
  );
}
