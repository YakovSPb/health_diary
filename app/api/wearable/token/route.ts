import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const createTokenSchema = z.object({
  label: z.string().max(100).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
  }

  const tokens = await prisma.wearableSyncToken.findMany({
    where: { userId: session.user.id },
    select: { id: true, label: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
  }

  let label: string | undefined;
  try {
    const body = await request.json();
    const parsed = createTokenSchema.safeParse(body);
    if (parsed.success) label = parsed.data.label;
  } catch {
    // body optional
  }

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const tokenPrefix = rawToken.slice(0, 12);

  await prisma.wearableSyncToken.create({
    data: {
      userId: session.user.id,
      tokenHash,
      tokenPrefix,
      label: label ?? 'Samsung Watch',
    },
  });

  // Токен показываем только один раз при создании
  return NextResponse.json(
    {
      token: rawToken,
      hint: 'Сохраните токен: он больше не будет показан. Используйте в заголовке: Authorization: Bearer <token>',
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Укажите id токена (query: id)' }, { status: 400 });
  }

  await prisma.wearableSyncToken.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
