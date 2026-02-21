import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Дневник',
  description: 'Дневник питания с калориями и БЖУ',
};

export default function DiaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
