import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

const CLEAR_SESSION_PATH = '/api/auth/clear-session';

export default async function Home() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect(CLEAR_SESSION_PATH);
  }
  if (session) redirect('/diary');
  redirect('/login');
}
