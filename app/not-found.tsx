import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">404</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Страница не найдена</p>
      <Link
        href="/"
        className="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
      >
        На главную
      </Link>
    </div>
  );
}
