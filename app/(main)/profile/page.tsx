import ProfileForm from '@/components/profile/ProfileForm';
import WearableTokens from '@/components/profile/WearableTokens';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Профиль',
  description: 'Вес, рост, возраст',
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      height: true,
      weight: true,
      birthDate: true,
      calorieDeficit: true,
    },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Профиль
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Укажите вес, рост и дату рождения для расчёта возраста
          </p>
        </div>

        <ProfileForm
          initialData={{
            name: user.name,
            height: user.height,
            weight: user.weight,
            birthDate: user.birthDate ? user.birthDate.toISOString().split('T')[0] : null,
            calorieDeficit: user.calorieDeficit,
          }}
        />

        <div className="mt-8">
          <WearableTokens />
        </div>
      </div>
    </div>
  );
}
