import MainNav from '@/components/layout/MainNav';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

const CLEAR_SESSION_PATH = '/api/auth/clear-session';
// Редирект сюда при JWTSessionError (смена AUTH_SECRET или конфликт с другим приложением на localhost:3000)

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth();
  } catch {
    redirect(CLEAR_SESSION_PATH);
  }

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MainNav
        userName={session.user.name ?? undefined}
        userEmail={session.user.email ?? undefined}
      />
      <main>{children}</main>
    </div>
  );
}
