import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

function caloriesFromBju(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}

const updateFoodSchema = z.object({
  name: z.string().min(1).optional(),
  carbsPer100g: z.number().min(0).optional(),
  proteinPer100g: z.number().min(0).nullish().transform((v) => (v === null ? 0 : v)),
  fatPer100g: z.number().min(0).nullish().transform((v) => (v === null ? 0 : v)),
  weightGrams: z.number().min(0).optional(),
});

async function recalcMealTotals(mealId: string) {
  const items = await prisma.foodItem.findMany({ where: { mealId } });
  const totalCarbs = items.reduce((s, i) => s + i.totalCarbs, 0);
  const totalProtein = items.reduce((s, i) => s + i.totalProtein, 0);
  const totalFat = items.reduce((s, i) => s + i.totalFat, 0);
  const totalCalories = items.reduce((s, i) => s + i.totalCalories, 0);
  await prisma.meal.update({
    where: { id: mealId },
    data: { totalCarbs, totalProtein, totalFat, totalCalories },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; foodId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mealId, foodId } = await params;
    const body = await request.json();
    const validatedData = updateFoodSchema.parse(body);

    const foodItem = await prisma.foodItem.findFirst({
      where: {
        id: foodId,
        mealId,
        meal: { userId: session.user.id },
      },
    });
    if (!foodItem) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    const newCarbs = validatedData.carbsPer100g ?? foodItem.carbsPer100g;
    const newProtein = validatedData.proteinPer100g ?? foodItem.proteinPer100g;
    const newFat = validatedData.fatPer100g ?? foodItem.fatPer100g;
    const newWeight = validatedData.weightGrams ?? foodItem.weightGrams;
    const k = newWeight / 100;

    const totalCarbs = newCarbs * k;
    const totalProtein = newProtein * k;
    const totalFat = newFat * k;
    const totalCalories = caloriesFromBju(newProtein, newCarbs, newFat) * k;

    await prisma.foodItem.update({
      where: { id: foodId },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.carbsPer100g !== undefined && { carbsPer100g: newCarbs }),
        ...(validatedData.proteinPer100g !== undefined && { proteinPer100g: newProtein }),
        ...(validatedData.fatPer100g !== undefined && { fatPer100g: newFat }),
        ...(validatedData.weightGrams !== undefined && { weightGrams: newWeight }),
        totalCarbs,
        totalProtein,
        totalFat,
        totalCalories,
      },
    });

    await recalcMealTotals(mealId);

    const updatedFoodItem = await prisma.foodItem.findUnique({
      where: { id: foodId },
    });
    return NextResponse.json({ foodItem: updatedFoodItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error updating food item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; foodId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mealId, foodId } = await params;

    const foodItem = await prisma.foodItem.findFirst({
      where: {
        id: foodId,
        mealId,
        meal: { userId: session.user.id },
      },
    });
    if (!foodItem) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    await prisma.foodItem.delete({ where: { id: foodId } });
    await recalcMealTotals(mealId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting food item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
