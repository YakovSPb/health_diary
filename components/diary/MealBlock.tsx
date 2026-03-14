'use client';

import { useEffect, useRef, useState } from 'react';
import BarcodeScannerModal from './BarcodeScannerModal';
import FoodItemRow from './FoodItemRow';
import VoiceInput from './VoiceInput';

interface FoodPhotoModalProps {
  onClose: () => void;
  onSubmit: (file: File) => void | Promise<void>;
  isSubmitting: boolean;
}

function FoodPhotoModal({
  onClose,
  onSubmit,
  isSubmitting,
}: FoodPhotoModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraSupported] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
  );
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (isCameraSupported && typeof window !== 'undefined') {
      const startCamera = async () => {
        try {
          setIsCameraLoading(true);
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
          setIsCameraLoading(false);
          setCameraError(null);
        } catch (e) {
          console.error('Food photo camera error:', e);
          setIsCameraLoading(false);
          setCameraError(
            'Не удалось получить доступ к камере. Разрешите доступ в браузере или выберите фото из галереи.'
          );
        }
      };

      startCamera();
    }

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isCameraSupported]);

  const handleTakePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (width === 0 || height === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.9)
    );
    if (!blob) return;

    const file = new File([blob], `meal-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });

    setSelectedFile(file);
  };

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedFile || isSubmitting) return;
    await onSubmit(selectedFile);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-photo-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="food-photo-modal-title"
          className="text-lg font-semibold text-gray-900 dark:text-white mb-3"
        >
          Фото еды
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Сделайте фото тарелки или выберите снимок из галереи. Приложение
          попробует распознать продукт, вес и БЖУ и добавить запись в дневник.
        </p>
        <div className="mb-4 space-y-3">
          {isCameraSupported && (
            <div className="space-y-2">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-black">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />
                {isCameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-sm text-white">
                      Загрузка камеры…
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={isCameraLoading || isSubmitting}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Сделать снимок с камеры
              </button>
            </div>
          )}
          {!isCameraSupported && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Камера недоступна. Выберите фото из галереи.
            </p>
          )}
          {cameraError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {cameraError}
            </p>
          )}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Или выберите фото из галереи
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                handleFileChange(file);
              }}
              className="block w-full text-sm text-gray-900 dark:text-gray-100 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
            />
            {selectedFile && (
              <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                Выбрано: {selectedFile.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedFile || isSubmitting}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Распознаём…' : 'Распознать и добавить'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  /** Добавить продукт по штрихкоду (Честный ЗНАК; затем меню → КБЖУ) */
  onAddFoodByBarcode?: (mealId: string, barcode: string) => void;
  /** Добавить продукт по фото (распознавание еды по изображению) */
  onAddFoodByPhoto?: (mealId: string, file: File) => void | Promise<void>;
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
  /** ID продуктов, добавленных из меню в этой сессии (для зелёной точки «из меню») */
  foodIdsFromMenu?: Set<string>;
  onSaveToMenu?: (mealId: string, foodId: string, name: string, carbs: number, protein: number, fat: number, caloriesPer100g?: number) => void;
  /** При открытии страницы: развёрнут только если с момента приёма прошло не более 30 минут */
  defaultExpanded?: boolean;
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
  onAddFoodByBarcode,
  onAddFoodByPhoto,
  onUpdateFood,
  onDeleteFood,
  onDelete,
  onAnalyze,
  savedToMenuFoodIds,
  foodIdsFromMenu,
  onSaveToMenu,
  defaultExpanded = false,
}: MealBlockProps) {
  const [time, setTime] = useState(initialTime);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isAddingFromPhoto, setIsAddingFromPhoto] = useState(false);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

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

  const handleBarcodeClick = () => {
    setShowBarcodeScanner(true);
  };

  const handleBarcodeDetected = async (barcode: string) => {
    const code = barcode.replace(/\D/g, '').trim();
    if (!code || !onAddFoodByBarcode || isAddingFood) return;
    setIsAddingFood(true);
    try {
      await onAddFoodByBarcode(id, code);
      setShowBarcodeScanner(false);
    } finally {
      setIsAddingFood(false);
    }
  };

  const handlePhotoClick = () => {
    if (isAddingFromPhoto || !onAddFoodByPhoto) return;
    setIsPhotoModalOpen(true);
  };

  const handlePhotoSubmit = async (file: File) => {
    if (!onAddFoodByPhoto || isAddingFromPhoto) return;
    setIsAddingFromPhoto(true);
    try {
      await onAddFoodByPhoto(id, file);
      setIsPhotoModalOpen(false);
    } finally {
      setIsAddingFromPhoto(false);
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
      {onAddFoodByBarcode && (
        <BarcodeScannerModal
          open={showBarcodeScanner}
          onClose={() => {
            if (isAddingFood) return;
            setShowBarcodeScanner(false);
          }}
          onDetected={handleBarcodeDetected}
          isSubmitting={isAddingFood}
        />
      )}
      {isPhotoModalOpen && onAddFoodByPhoto && (
        <FoodPhotoModal
          onClose={() => {
            if (isAddingFromPhoto) return;
            setIsPhotoModalOpen(false);
          }}
          isSubmitting={isAddingFromPhoto}
          onSubmit={handlePhotoSubmit}
        />
      )}
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => setIsExpanded((e) => !e)}
          className={`${touchIconBtn} shrink-0 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400`}
          title={isExpanded ? 'Свернуть' : 'Развернуть'}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Свернуть приём' : 'Развернуть приём'}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsExpanded((e) => !e)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsExpanded((prev) => !prev)}
          className="flex flex-wrap items-center gap-3 flex-1 min-w-0 cursor-pointer select-none"
          aria-expanded={isExpanded}
        >
          <input
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="text-base px-3 py-2.5 sm:px-4 sm:py-2 font-semibold border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white min-h-[44px]"
          />
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            {mealName}
          </h3>
          {foodItems.length > 0 && (
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Б: {totalProtein.toFixed(0)} · Ж: {totalFat.toFixed(0)} · У: {totalCarbs.toFixed(0)} · {Math.round(totalCalories)} ккал
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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

      {isExpanded && foodItems.length > 0 && (
        <>
          <div className="mb-4 overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-32">Название</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Б/100</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Ж/100</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">У/100</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Вес, г</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">К/100</th>
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
                    fromMenu={!!item.menuItemId || foodIdsFromMenu?.has(item.id)}
                    savedToMenu={savedToMenuFoodIds?.has(item.id)}
                    onSaveToMenu={
                      onSaveToMenu
                        ? (name, carbs, protein, fat, caloriesPer100g) =>
                            onSaveToMenu(id, item.id, name, carbs, protein, fat, caloriesPer100g)
                        : undefined
                    }
                    hasSugar={(item.sugarsPer100g ?? 0) > 0}
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
                fromMenu={!!item.menuItemId || foodIdsFromMenu?.has(item.id)}
                savedToMenu={savedToMenuFoodIds?.has(item.id)}
                onSaveToMenu={
                  onSaveToMenu
                    ? (name, carbs, protein, fat, caloriesPer100g) =>
                        onSaveToMenu(id, item.id, name, carbs, protein, fat, caloriesPer100g)
                    : undefined
                }
                hasSugar={(item.sugarsPer100g ?? 0) > 0}
              />
            ))}
          </div>
        </>
      )}

      {isExpanded && (
        <>
          <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="w-full">
              <VoiceInput
                onResult={handleAddFoodFromVoice}
                disabled={isAddingFood}
                onBarcodeClick={onAddFoodByBarcode ? handleBarcodeClick : undefined}
                onPhotoClick={onAddFoodByPhoto ? handlePhotoClick : undefined}
              />
            </div>
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
        </>
      )}
    </div>
  );
}
