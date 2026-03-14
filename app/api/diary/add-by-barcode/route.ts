import { auth } from '@/lib/auth';
import { findProductByBarcode } from '@/lib/barcode-apis';
import { getCurrentTime } from '@/lib/date-utils';
import { findFood, searchInMenu } from '@/lib/food-search';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

function caloriesFromBju(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}

function hasBju(c: number, p: number, f: number): boolean {
  return c > 0 || p > 0 || f > 0;
}

const bodySchema = z.object({
  barcode: z.string().min(1).max(32),
  mealId: z.string().optional(),
  date: z.string().optional(),
  weightGrams: z.number().min(1).max(10000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { barcode, mealId, date, weightGrams: rawWeight } = bodySchema.parse(body);
    const weightGrams = rawWeight ?? 100;

    const barcodeResult = await findProductByBarcode(barcode);
    if (!barcodeResult?.product?.name) {
      return NextResponse.json(
        { error: 'Товар по штрихкоду не найден (Честный ЗНАК).' },
        { status: 404 }
      );
    }

    const productName = barcodeResult.product.name;
    let name: string;
    let carbsPer100g: number;
    let proteinPer100g: number;
    let fatPer100g: number;
    let sugarsPer100g: number | undefined;
    let menuItemId: string | undefined;

    const menuResults = await searchInMenu(prisma, session.user.id, productName);
    const menuFirst = menuResults[0];
    if (menuFirst && hasBju(menuFirst.carbsPer100g, menuFirst.proteinPer100g, menuFirst.fatPer100g)) {
      name = menuFirst.name;
      carbsPer100g = menuFirst.carbsPer100g;
      proteinPer100g = menuFirst.proteinPer100g;
      fatPer100g = menuFirst.fatPer100g;
      sugarsPer100g = menuFirst.sugarsPer100g;
      const menuItem = await prisma.menuItem.findFirst({
        where: { userId: session.user.id, name: menuFirst.name },
        select: { id: true },
      });
      menuItemId = menuItem?.id;
    } else {
      const fromBarcode = barcodeResult.product;
      if (
        hasBju(
          fromBarcode.carbsPer100g ?? 0,
          fromBarcode.proteinPer100g ?? 0,
          fromBarcode.fatPer100g ?? 0
        )
      ) {
        name = fromBarcode.name;
        carbsPer100g = fromBarcode.carbsPer100g ?? 0;
        proteinPer100g = fromBarcode.proteinPer100g ?? 0;
        fatPer100g = fromBarcode.fatPer100g ?? 0;
        sugarsPer100g = fromBarcode.sugarsPer100g;
      } else {
        const found = await findFood(prisma, session.user.id, productName);
        if (!found) {
          name = fromBarcode.name;
          carbsPer100g = 0;
          proteinPer100g = 0;
          fatPer100g = 0;
          sugarsPer100g = fromBarcode.sugarsPer100g;
        } else {
          name = found.result.name;
          carbsPer100g = found.result.carbsPer100g;
          proteinPer100g = found.result.proteinPer100g;
          fatPer100g = found.result.fatPer100g;
          sugarsPer100g = found.result.sugarsPer100g;
        }
      }
    }

    let meal: {
      id: string;
      foodItems: { totalCarbs: number; totalProtein: number; totalFat: number; totalCalories: number }[];
    } | null;

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

    const k = weightGrams / 100;
    const totalCarbs = carbsPer100g * k;
    const totalProtein = proteinPer100g * k;
    const totalFat = fatPer100g * k;
    const totalCalories = caloriesFromBju(proteinPer100g, carbsPer100g, fatPer100g) * k;
    const order = meal.foodItems.length;

    const foodItem = await prisma.foodItem.create({
      data: {
        mealId: meal.id,
        name,
        carbsPer100g,
        proteinPer100g,
        fatPer100g,
        sugarsPer100g: sugarsPer100g ?? undefined,
        weightGrams,
        totalCarbs,
        totalProtein,
        totalFat,
        totalCalories,
        order,
        menuItemId: menuItemId ?? undefined,
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
        sugarsPer100g: foodItem.sugarsPer100g ?? undefined,
        weightGrams: foodItem.weightGrams,
        totalCarbs: foodItem.totalCarbs,
        totalProtein: foodItem.totalProtein,
        totalFat: foodItem.totalFat,
        totalCalories: foodItem.totalCalories,
        order: foodItem.order,
        menuItemId: foodItem.menuItemId ?? undefined,
      },
      source: menuItemId ? 'menu' : 'barcode',
      mealId: meal.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error add-by-barcode:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
