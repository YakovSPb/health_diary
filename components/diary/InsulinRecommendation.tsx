'use client';

import { useState, useEffect } from 'react';

interface InsulinRecommendationProps {
  mealId: string;
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
  time: string;
  currentGlucose?: number;
  trend?: string;
}

interface Recommendation {
  byRatio: {
    units: number;
    ratio: number;
    explanation: string;
  };
  byHistory: {
    units: number;
    confidence: 'high' | 'medium' | 'low';
    explanation: string;
    similarMealsFound: number;
  } | null;
  ratioAdjustment: {
    currentRatio: number;
    suggestedRatio: number;
    reason: string;
  } | null;
}

export default function InsulinRecommendation({
  mealId,
  totalCarbs,
  totalProtein,
  totalFat,
  time,
  currentGlucose,
  trend,
}: InsulinRecommendationProps) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (totalCarbs > 0) {
      fetchRecommendation();
    }
  }, [totalCarbs, totalProtein, totalFat, time]);

  const fetchRecommendation = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/insulin/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalCarbs,
          totalProtein,
          totalFat,
          time,
          currentGlucose,
          trend,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Ошибка получения рекомендации');
        return;
      }

      setRecommendation(data);
    } catch (error) {
      setError('Ошибка получения рекомендации');
    } finally {
      setIsLoading(false);
    }
  };

  if (totalCarbs === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">Загрузка рекомендаций...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!recommendation) {
    return null;
  }

  const confidenceColors = {
    high: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20',
    medium: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20',
    low: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20',
  };

  const confidenceLabels = {
    high: 'Высокая уверенность',
    medium: 'Средняя уверенность',
    low: 'Низкая уверенность',
  };

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        Рекомендации по дозе инсулина
      </h3>

      {/* Рекомендация по УК */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            По углеводному коэффициенту
          </span>
          <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {recommendation.byRatio.units} ЕД
          </span>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {recommendation.byRatio.explanation}
        </p>
      </div>

      {/* Рекомендация по истории */}
      {recommendation.byHistory && (
        <div className={`p-4 rounded-lg border ${
          recommendation.byHistory.confidence === 'high' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : recommendation.byHistory.confidence === 'medium'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${
                recommendation.byHistory.confidence === 'high'
                  ? 'text-green-900 dark:text-green-100'
                  : recommendation.byHistory.confidence === 'medium'
                  ? 'text-yellow-900 dark:text-yellow-100'
                  : 'text-orange-900 dark:text-orange-100'
              }`}>
                На основе истории
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${confidenceColors[recommendation.byHistory.confidence]}`}>
                {confidenceLabels[recommendation.byHistory.confidence]}
              </span>
            </div>
            <span className={`text-2xl font-bold ${
              recommendation.byHistory.confidence === 'high'
                ? 'text-green-700 dark:text-green-300'
                : recommendation.byHistory.confidence === 'medium'
                ? 'text-yellow-700 dark:text-yellow-300'
                : 'text-orange-700 dark:text-orange-300'
            }`}>
              {recommendation.byHistory.units} ЕД
            </span>
          </div>
          <p className={`text-xs ${
            recommendation.byHistory.confidence === 'high'
              ? 'text-green-700 dark:text-green-300'
              : recommendation.byHistory.confidence === 'medium'
              ? 'text-yellow-700 dark:text-yellow-300'
              : 'text-orange-700 dark:text-orange-300'
          }`}>
            {recommendation.byHistory.explanation}
          </p>
        </div>
      )}

      {/* Рекомендация по изменению УК */}
      {recommendation.ratioAdjustment && (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Рекомендация по изменению УК
            </span>
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
            <p>
              Текущий УК: <span className="font-semibold">{recommendation.ratioAdjustment.currentRatio}</span>
            </p>
            <p>
              Рекомендуемый УК: <span className="font-semibold">{recommendation.ratioAdjustment.suggestedRatio}</span>
            </p>
            <p className="text-xs mt-2">
              {recommendation.ratioAdjustment.reason}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
