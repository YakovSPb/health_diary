import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мониторинг',
  description: 'Данные с Samsung Watch и носимых устройств',
};

export default function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
