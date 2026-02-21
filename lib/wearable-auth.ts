import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';

const BEARER_PREFIX = 'Bearer ';

/**
 * Возвращает userId для запроса: из сессии или из заголовка Authorization: Bearer <token>.
 * Токен — тот, что выдан в «Токен для приложения» (WearableSyncToken).
 */
export async function getWearableUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  const headersList = await headers();
  const authorization = headersList.get('authorization');
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorization.slice(BEARER_PREFIX.length).trim();
  if (!token) return null;

  const prefix = token.length >= 12 ? token.slice(0, 12) : token;
  const record = await prisma.wearableSyncToken.findUnique({
    where: { tokenPrefix: prefix },
  });
  if (!record) return null;

  const valid = await bcrypt.compare(token, record.tokenHash);
  return valid ? record.userId : null;
}
