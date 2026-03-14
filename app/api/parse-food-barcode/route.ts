import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseFoodFromText } from '@/lib/deepseek-search';
import { z } from 'zod';

const parseBarcodeSchema = z.object({
  barcode: z.string().min(6).max(32),
});

const parseNutrimentNumber = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  const normalized = String(value).replace(',', '.').trim();
  if (!normalized) return undefined;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return num;
};

type CanonicalNutriments = Record<string, unknown> & {
  carbohydrates_100g?: unknown;
  carbs_100g?: unknown;
  proteins_100g?: unknown;
  protein_100g?: unknown;
  fat_100g?: unknown;
  fats_100g?: unknown;
};

interface CanonicalProduct {
  source: 'roskachestvo' | 'openfoodfacts';
  rawProduct: unknown;
  rawNutriments: CanonicalNutriments | null;
  name: string;
  nutriments: CanonicalNutriments;
}

const ROSKACHESTVO_TIMEOUT_MS = 2500;

/** Как в diabalance: только search/barcode, без второго запроса. */
const tryFetchFromRoskachestvo = async (
  barcode: string
): Promise<CanonicalProduct | null> => {
  const url = `https://rskrf.ru/rest/1/search/barcode?barcode=${encodeURIComponent(barcode)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROSKACHESTVO_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) return null;
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;

    const productList =
      data?.products ?? data?.items ?? data?.result ?? null;
    const product =
      (Array.isArray(productList) && productList.length > 0 ? productList[0] : null) ??
      (data?.product as Record<string, unknown> | undefined) ??
      data;

    if (!product || typeof product !== 'object') return null;

    const p = product as Record<string, unknown>;
    const rawName: string =
      (p.name as string) ?? (p.title as string) ?? (p.product_name_ru as string) ?? (p.product_name as string) ?? 'Продукт по штрихкоду';

    const nutriments: CanonicalNutriments =
      (p.nutriments as CanonicalNutriments | undefined) ??
      (p.nutrition as CanonicalNutriments | undefined) ??
      {};

    // Пустой ответ Роскачества ({ response: {}, message: [] }) — не считать найденным, чтобы попробовать Open Food Facts
    const hasRealName = !!(p.name ?? p.title ?? p.product_name_ru ?? p.product_name);
    const responseObj = p.response as Record<string, unknown> | undefined;
    const isEmptyResponse = responseObj && typeof responseObj === 'object' && Object.keys(responseObj).length === 0;
    if (!hasRealName && (isEmptyResponse || (!p.name && !p.title))) {
      return null;
    }

    return {
      source: 'roskachestvo',
      rawProduct: product,
      rawNutriments: Object.keys(nutriments).length > 0 ? nutriments : null,
      name: rawName,
      nutriments,
    };
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') return null;
    console.error('Roskachestvo barcode failed:', barcode, e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

/** Как в diabalance: тот же URL, без доп. заголовков. */
const fetchFromOpenFoodFacts = async (
  barcode: string
): Promise<CanonicalProduct | null> => {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

  try {
    const response = await fetch(url);

    if (response.status === 404) return null;
    if (!response.ok) return null;

    const data = (await response.json()) as { status?: number; product?: Record<string, unknown> };
    if (!data || data.status !== 1 || !data.product) return null;

    const product = data.product;

    const rawName: string =
      (product.product_name_ru as string) ||
      (product.product_name as string) ||
      (product.generic_name_ru as string) ||
      (product.generic_name as string) ||
      (product.abbreviated_product_name_ru as string) ||
      (product.abbreviated_product_name as string) ||
      'Продукт по штрихкоду';

    const nutriments: CanonicalNutriments =
      (product.nutriments as CanonicalNutriments | undefined) ?? {};

    return {
      source: 'openfoodfacts',
      rawProduct: product,
      rawNutriments: product.nutriments ?? null,
      name: rawName,
      nutriments,
    };
  } catch (e) {
    console.error('OpenFoodFacts barcode failed:', barcode, e);
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { barcode } = parseBarcodeSchema.parse(body);
    const trimmed = barcode.trim();
    const code = trimmed.replace(/\D/g, '');
    if (!code || code.length < 8) {
      return NextResponse.json(
        { error: 'Продукт по этому штрихкоду не найден' },
        { status: 404 }
      );
    }

    let productData: CanonicalProduct | null =
      await tryFetchFromRoskachestvo(code);
    if (!productData) {
      productData = await fetchFromOpenFoodFacts(code);
    }

    if (!productData) {
      return NextResponse.json(
        { error: 'Продукт по этому штрихкоду не найден' },
        { status: 404 }
      );
    }

    const { name: rawName, nutriments, source, rawProduct, rawNutriments } =
      productData;

    let cleanedName = String(rawName).trim();
    cleanedName = cleanedName.replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ');
    const commaIndex = cleanedName.indexOf(',');
    if (commaIndex > 0) cleanedName = cleanedName.slice(0, commaIndex);
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!cleanedName) cleanedName = 'Продукт по штрихкоду';

    let carbsPer100g =
      parseNutrimentNumber(
        nutriments.carbohydrates_100g ??
          nutriments['carbohydrates_100g'] ??
          nutriments.carbs_100g ??
          nutriments['carbs_100g']
      ) ?? 0;

    let proteinPer100gNumber = parseNutrimentNumber(
      nutriments.proteins_100g ??
        nutriments['proteins_100g'] ??
        nutriments.protein_100g ??
        nutriments['protein_100g']
    );

    let fatPer100gNumber = parseNutrimentNumber(
      nutriments.fat_100g ??
        nutriments['fat_100g'] ??
        nutriments.fats_100g ??
        nutriments['fats_100g']
    );

    const hasAnyMacroFromBarcode =
      (nutriments.carbohydrates_100g ??
        nutriments['carbohydrates_100g'] ??
        nutriments.carbs_100g ??
        nutriments['carbs_100g']) != null ||
      (nutriments.proteins_100g ??
        nutriments['proteins_100g'] ??
        nutriments.protein_100g ??
        nutriments['protein_100g']) != null ||
      (nutriments.fat_100g ??
        nutriments['fat_100g'] ??
        nutriments.fats_100g ??
        nutriments['fats_100g']) != null;

    if (!hasAnyMacroFromBarcode) {
      try {
        const parsed = await parseFoodFromText(`100 г ${cleanedName}`);
        carbsPer100g = parsed.carbsPer100g ?? carbsPer100g;
        proteinPer100gNumber = parsed.proteinPer100g ?? proteinPer100gNumber;
        fatPer100gNumber = parsed.fatPer100g ?? fatPer100gNumber;
      } catch (e) {
        console.error('Fallback parseFoodFromText failed for barcode:', code, e);
      }
    }

    let menuItemId: string | undefined;
    try {
      const existing = await prisma.menuItem.findFirst({
        where: { userId: session.user.id, name: cleanedName },
      });
      if (existing) {
        menuItemId = existing.id;
        carbsPer100g = existing.carbsPer100g;
        if (existing.proteinPer100g != null) proteinPer100gNumber = existing.proteinPer100g;
        if (existing.fatPer100g != null) fatPer100gNumber = existing.fatPer100g;
      }
    } catch (e) {
      console.error('Error overriding barcode macros from menu:', e);
    }

    if (!Number.isFinite(carbsPer100g) || carbsPer100g < 0) {
      return NextResponse.json(
        { error: 'У продукта нет корректных данных по углеводам на 100г' },
        { status: 422 }
      );
    }

    const food = {
      name: cleanedName,
      carbsPer100g,
      weightGrams: 100,
      proteinPer100g: proteinPer100gNumber,
      fatPer100g: fatPer100gNumber,
      menuItemId,
    };

    return NextResponse.json({
      food,
      rawProduct,
      rawNutriments,
      menuItemId,
      source,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error parsing food by barcode:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse food by barcode',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
