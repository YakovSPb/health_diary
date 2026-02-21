import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

function caloriesFromBju(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}

const createMenuSchema = z.object({
  name: z.string().min(1).max(500),
  carbsPer100g: z.coerce.number().min(0),
  proteinPer100g: z.coerce.number().min(0).optional(),
  fatPer100g: z.coerce.number().min(0).optional(),
  caloriesPer100g: z.coerce.number().min(0).optional(),
});

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
    const search = (searchParams.get('search') ?? '').trim();

    let items: Awaited<ReturnType<typeof prisma.menuItem.findMany>>;
    let total: number;

    if (search.trim()) {
      const all = await prisma.menuItem.findMany({
        where: { userId: session.user.id },
        orderBy: [{ name: 'asc' }],
      });
      const searchLower = search.toLowerCase();
      const filtered = all.filter((i) => i.name.toLowerCase().includes(searchLower));
      total = filtered.length;
      items = filtered.slice((page - 1) * limit, page * limit);
    } else {
      [items, total] = await Promise.all([
        prisma.menuItem.findMany({
          where: { userId: session.user.id },
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.menuItem.count({ where: { userId: session.user.id } }),
      ]);
    }

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching menu:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createMenuSchema.parse(body);

    const protein = validated.proteinPer100g ?? 0;
    const fat = validated.fatPer100g ?? 0;
    const carbs = validated.carbsPer100g;
    const caloriesPer100g =
      validated.caloriesPer100g ?? caloriesFromBju(protein, carbs, fat);

    const trimmedName = validated.name.trim();
    const existing = await prisma.menuItem.findFirst({
      where: {
        userId: session.user.id,
        name: trimmedName,
      },
    });

    const item = existing
      ? await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            carbsPer100g: carbs,
            proteinPer100g: protein,
            fatPer100g: fat,
            caloriesPer100g,
          },
        })
      : await prisma.menuItem.create({
          data: {
            userId: session.user.id,
            name: trimmedName,
            carbsPer100g: carbs,
            proteinPer100g: protein,
            fatPer100g: fat,
            caloriesPer100g,
          },
        });

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error creating menu item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
