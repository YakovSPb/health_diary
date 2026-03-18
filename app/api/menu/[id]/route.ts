import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSharedMenuEnabled, sharedMenuRequest } from '@/lib/shared-menu-service';
import { z } from 'zod';

function caloriesFromBju(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}

const updateMenuSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  carbsPer100g: z.coerce.number().min(0).optional(),
  proteinPer100g: z.coerce.number().min(0).optional(),
  fatPer100g: z.coerce.number().min(0).optional(),
  caloriesPer100g: z.coerce.number().min(0).optional(),
  hasSugar: z.boolean().optional(),
  defaultPortionGrams: z.coerce.number().min(1).max(10000).optional(),
  recipeText: z.string().max(10000).optional(),
});

function getSessionEmail(session: Awaited<ReturnType<typeof auth>>): string | null {
  const email = session?.user?.email?.trim().toLowerCase();
  return email || null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateMenuSchema.parse(body);

    if (isSharedMenuEnabled()) {
      const email = getSessionEmail(session);
      if (!email) {
        return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
      }
      const sharedResult = await sharedMenuRequest<{ item: unknown }>({
        method: 'PATCH',
        email,
        path: `/api/menu/${id}`,
        body: validated,
      });
      return NextResponse.json(sharedResult);
    }

    const existing = await prisma.menuItem.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'MenuItem not found' }, { status: 404 });
    }

    const protein = validated.proteinPer100g ?? existing.proteinPer100g;
    const fat = validated.fatPer100g ?? existing.fatPer100g;
    const carbs = validated.carbsPer100g ?? existing.carbsPer100g;
    const caloriesPer100g =
      validated.caloriesPer100g ?? caloriesFromBju(protein, carbs, fat);

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(validated.name !== undefined && { name: validated.name.trim() }),
        carbsPer100g: carbs,
        proteinPer100g: protein,
        fatPer100g: fat,
        caloriesPer100g,
        ...(validated.hasSugar !== undefined && { hasSugar: validated.hasSugar }),
        ...(validated.defaultPortionGrams !== undefined && {
          defaultPortionGrams: validated.defaultPortionGrams,
        }),
        ...(validated.recipeText !== undefined && {
          recipeText: validated.recipeText ?? null,
        }),
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error updating menu item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (isSharedMenuEnabled()) {
      const email = getSessionEmail(session);
      if (!email) {
        return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
      }
      const sharedResult = await sharedMenuRequest<{ success: boolean }>({
        method: 'DELETE',
        email,
        path: `/api/menu/${id}`,
      });
      return NextResponse.json(sharedResult);
    }

    const existing = await prisma.menuItem.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'MenuItem not found' }, { status: 404 });
    }

    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
