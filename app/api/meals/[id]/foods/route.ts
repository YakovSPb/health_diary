import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

function caloriesFromBju(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}

const createFoodSchema = z.object({
  name: z.string().min(1),
  carbsPer100g: z.number().min(0),
  proteinPer100g: z.number().min(0).optional(),
  fatPer100g: z.number().min(0).optional(),
  weightGrams: z.number().min(0),
  order: z.number().int().min(0).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mealId } = await params;
    const body = await request.json();
    const validatedData = createFoodSchema.parse(body);

    const meal = await prisma.meal.findFirst({
      where: { id: mealId, userId: session.user.id },
      include: { foodItems: true },
    });
    if (!meal) {
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    const protein = validatedData.proteinPer100g ?? 0;
    const fat = validatedData.fatPer100g ?? 0;
    const carbs = validatedData.carbsPer100g;
    const weight = validatedData.weightGrams;
    const k = weight / 100;

    const totalCarbs = carbs * k;
    const totalProtein = protein * k;
    const totalFat = fat * k;
    const totalCalories = caloriesFromBju(protein, carbs, fat) * k;

    const order = validatedData.order ?? meal.foodItems.length;

    const foodItem = await prisma.foodItem.create({
      data: {
        mealId,
        name: validatedData.name,
        carbsPer100g: carbs,
        proteinPer100g: protein,
        fatPer100g: fat,
        weightGrams: weight,
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
      where: { id: mealId },
      data: {
        totalCarbs: newTotalCarbs,
        totalProtein: newTotalProtein,
        totalFat: newTotalFat,
        totalCalories: newTotalCalories,
      },
    });

    return NextResponse.json({ foodItem }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error creating food item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
