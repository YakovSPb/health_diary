import {
  getDailyCaloriesNeeded,
  getOptimalWeight,
  SUGGESTED_CALORIE_DEFICIT,
} from '@/lib/calories';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  name: z.string().optional(),
  height: z.number().int().min(50).max(250).nullable().optional(),
  weight: z.number().min(20).max(300).nullable().optional(),
  birthDate: z.string().nullable().optional(),
  calorieDeficit: z.number().int().min(0).max(2000).nullable().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        height: true,
        weight: true,
        birthDate: true,
        calorieDeficit: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const height = user.height ?? 0;
    const weight = user.weight ?? 0;
    const birthDate = user.birthDate ?? null;
    const optimalWeight =
      height > 0 ? getOptimalWeight(height) : null;
    const dailyCaloriesNeeded =
      height > 0 && weight > 0
        ? getDailyCaloriesNeeded(height, weight, birthDate)
        : null;
    const suggestedDeficit = SUGGESTED_CALORIE_DEFICIT;

    return NextResponse.json({
      ...user,
      birthDate: user.birthDate?.toISOString().split('T')[0] ?? null,
      optimalWeight,
      dailyCaloriesNeeded,
      suggestedDeficit,
    });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Ошибка при получении профиля' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = profileUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0]?.message ?? 'Ошибка валидации' },
        { status: 400 }
      );
    }

    const { name, height, weight, birthDate, calorieDeficit } =
      validationResult.data;

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name: name === '' ? null : name }),
        ...(height !== undefined && { height }),
        ...(weight !== undefined && { weight }),
        ...(birthDate !== undefined && {
          birthDate: birthDate ? new Date(birthDate) : null,
        }),
        ...(calorieDeficit !== undefined && { calorieDeficit }),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        height: updatedUser.height,
        weight: updatedUser.weight,
        birthDate: updatedUser.birthDate?.toISOString().split('T')[0] ?? null,
        calorieDeficit: updatedUser.calorieDeficit,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Ошибка при обновлении профиля' }, { status: 500 });
  }
}
