'use client';

interface AnalysisReportProps {
  report: string;
  stats?: {
    mealsCount: number;
    readingsCount: number;
    avgGlucose: number;
    timeInRange: number;
    totalCarbs: number;
    totalInsulin: number;
  };
}

export function AnalysisReport({ report, stats }: AnalysisReportProps) {
  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Приёмов</p>
            <p className="font-semibold text-gray-900 dark:text-white">{stats.mealsCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Измерений</p>
            <p className="font-semibold text-gray-900 dark:text-white">{stats.readingsCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Средний сахар</p>
            <p className="font-semibold text-gray-900 dark:text-white">{stats.avgGlucose}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">В целевом %</p>
            <p className="font-semibold text-green-600">{stats.timeInRange}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Углеводы</p>
            <p className="font-semibold text-gray-900 dark:text-white">{stats.totalCarbs} г</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Инсулин</p>
            <p className="font-semibold text-gray-900 dark:text-white">{stats.totalInsulin} ЕД</p>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
        <div className="prose dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 bg-transparent p-0 border-0">
            {report}
          </pre>
        </div>
      </div>
    </div>
  );
}
