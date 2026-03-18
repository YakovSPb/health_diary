import { auth } from '@/lib/auth';
import { prepareSearchQuery, scoreMenuItemWithRecipe } from '@/lib/menu-search';
import { prisma } from '@/lib/prisma';
import { isSharedMenuEnabled, sharedMenuRequest } from '@/lib/shared-menu-service';
import { normalizeRecipeSearchQuery } from '@/lib/recipe-name';
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
  hasSugar: z.boolean().optional(),
  defaultPortionGrams: z.coerce.number().min(1).max(10000).optional(),
  /** Текст рецепта (ингредиенты). Если передан — пункт считается рецептом и показывается на странице Рецепты */
  recipeText: z.string().max(10000).optional(),
});

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function getSessionEmail(session: Awaited<ReturnType<typeof auth>>): string | null {
  const email = session?.user?.email?.trim().toLowerCase();
  return email || null;
}

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
    const recipesOnly = searchParams.get('recipesOnly') === 'true';

    if (isSharedMenuEnabled()) {
      const email = getSessionEmail(session);
      if (!email) {
        return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
      }
      const sharedResult = await sharedMenuRequest<{
        items: unknown[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>({
        email,
        path: '/api/menu',
        query: {
          page,
          limit,
          search: search || undefined,
          recipesOnly: recipesOnly || undefined,
        },
      });
      return NextResponse.json(sharedResult);
    }

    const baseWhere: { userId: string; recipeText?: { not: null } } = {
      userId: session.user.id,
    };
    if (recipesOnly) {
      baseWhere.recipeText = { not: null };
    }

    let items: Awaited<ReturnType<typeof prisma.menuItem.findMany>>;
    let total: number;

    if (search) {
      const cleanedSearch = recipesOnly
        ? normalizeRecipeSearchQuery(search)
        : search.replace(/\d+\s*(г|грамм[а-я]*|гр\.?|мл|кг|л)/gi, '').trim();
      const preparedQuery = prepareSearchQuery(cleanedSearch);

      const allItems = await prisma.menuItem.findMany({
        where: baseWhere,
      });

      const scoredItems = allItems
        .map((item) => {
          const score = scoreMenuItemWithRecipe(
            preparedQuery,
            item.name,
            recipesOnly ? normalizeRecipeSearchQuery(item.recipeText ?? '') || undefined : item.recipeText
          );
          return { item, score };
        })
        .filter(({ score }) => score > 0);

      scoredItems.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.item.name.localeCompare(b.item.name);
      });

      total = scoredItems.length;
      items = scoredItems.slice((page - 1) * limit, page * limit).map(({ item }) => item);
    } else {
      [items, total] = await Promise.all([
        prisma.menuItem.findMany({
          where: baseWhere,
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.menuItem.count({ where: baseWhere }),
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

    if (isSharedMenuEnabled()) {
      const email = getSessionEmail(session);
      if (!email) {
        return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
      }
      const sharedResult = await sharedMenuRequest<{ item: unknown }>({
        method: 'POST',
        email,
        path: '/api/menu',
        body: validated,
      });
      return NextResponse.json(sharedResult);
    }

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

    const hasSugar = validated.hasSugar ?? false;
    const item = existing
      ? await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            carbsPer100g: carbs,
            proteinPer100g: protein,
            fatPer100g: fat,
            caloriesPer100g,
            hasSugar,
            ...(validated.defaultPortionGrams !== undefined && {
              defaultPortionGrams: validated.defaultPortionGrams,
            }),
            ...(validated.recipeText !== undefined && {
              recipeText: validated.recipeText ?? null,
            }),
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
            hasSugar,
            defaultPortionGrams: validated.defaultPortionGrams ?? 100,
            recipeText: validated.recipeText ?? null,
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
