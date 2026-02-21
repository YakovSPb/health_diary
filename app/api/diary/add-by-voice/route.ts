import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findFood } from '@/lib/food-search';
import { parseVoiceFoodText } from '@/lib/voice-parse';
import { getCurrentTime } from '@/lib/date-utils';
import { z } from 'zod';

function caloriesFromBju(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
  mealId: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD для выбора дня при отсутствии mealId
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, mealId, date } = bodySchema.parse(body);

    const { productName, weightGrams } = parseVoiceFoodText(text);
    if (!productName.trim()) {
      return NextResponse.json(
        { error: 'Не удалось определить название продукта из фразы.' },
        { status: 400 }
      );
    }

    let meal: { id: string; foodItems: { totalCarbs: number; totalProtein: number; totalFat: number; totalCalories: number }[] } | null;

    if (mealId) {
      meal = await prisma.meal.findFirst({
        where: { id: mealId, userId: session.user.id },
        include: { foodItems: true },
      });
      if (!meal) {
        return NextResponse.json({ error: 'Приём пищи не найден' }, { status: 404 });
      }
    } else if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const existing = await prisma.meal.findFirst({
        where: {
          userId: session.user.id,
          date: { gte: startOfDay, lte: endOfDay },
        },
        include: { foodItems: true },
        orderBy: { time: 'desc' },
      });

      if (existing) {
        meal = existing;
      } else {
        const created = await prisma.meal.create({
          data: {
            userId: session.user.id,
            date: startOfDay,
            time: getCurrentTime(),
            totalCarbs: 0,
            totalProtein: 0,
            totalFat: 0,
            totalCalories: 0,
          },
          include: { foodItems: true },
        });
        meal = created;
      }
    } else {
      return NextResponse.json(
        { error: 'Укажите mealId или date для добавления продукта.' },
        { status: 400 }
      );
    }

    const found = await findFood(prisma, session.user.id, productName);
    if (!found) {
      const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
      const error = hasDeepSeek
        ? `Продукт «${productName}» не найден в меню и по базе. Попробуйте другое название или добавьте блюдо в меню.`
        : `Продукт «${productName}» не найден в меню. Для поиска по базе укажите DEEPSEEK_API_KEY в .env`;
      return NextResponse.json({ error }, { status: 404 });
    }

    const { result, source } = found;
    const k = weightGrams / 100;
    const totalCarbs = result.carbsPer100g * k;
    const totalProtein = result.proteinPer100g * k;
    const totalFat = result.fatPer100g * k;
    const totalCalories = caloriesFromBju(result.proteinPer100g, result.carbsPer100g, result.fatPer100g) * k;
    const order = meal.foodItems.length;

    const foodItem = await prisma.foodItem.create({
      data: {
        mealId: meal.id,
        name: result.name,
        carbsPer100g: result.carbsPer100g,
        proteinPer100g: result.proteinPer100g,
        fatPer100g: result.fatPer100g,
        weightGrams,
        totalCarbs,
        totalProtein,
        totalFat,
        totalCalories,
        order,
      },
    });

    const newTotalCarbs = meal.foodItems.reduce((s, i) => s + i.totalCarbs, 0) + totalCarbs;
    const newTotalProtein = meal.foodItems.reduce((s, i) => s + i.totalProtein, 0) + totalProtein;
    const newTotalFat = meal.foodItems.reduce((s, i) => s + i.totalFat, 0) + totalFat;
    const newTotalCalories = meal.foodItems.reduce((s, i) => s + i.totalCalories, 0) + totalCalories;

    await prisma.meal.update({
      where: { id: meal.id },
      data: {
        totalCarbs: newTotalCarbs,
        totalProtein: newTotalProtein,
        totalFat: newTotalFat,
        totalCalories: newTotalCalories,
      },
    });

    return NextResponse.json({
      success: true,
      foodItem: {
        id: foodItem.id,
        name: foodItem.name,
        carbsPer100g: foodItem.carbsPer100g,
        proteinPer100g: foodItem.proteinPer100g,
        fatPer100g: foodItem.fatPer100g,
        weightGrams: foodItem.weightGrams,
        totalCarbs: foodItem.totalCarbs,
        totalProtein: foodItem.totalProtein,
        totalFat: foodItem.totalFat,
        totalCalories: foodItem.totalCalories,
        order: foodItem.order,
      },
      source: source,
      mealId: meal.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error add-by-voice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
