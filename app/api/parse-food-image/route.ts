import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseFoodFromImage } from '@/lib/deepseek-search';
import { prisma } from '@/lib/prisma';

/** POST /api/parse-food-image — распознать еду по фото (как в diabalance). */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Ожидается multipart/form-data с полем image' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Файл изображения не найден' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Неверный формат изображения' },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = Buffer.from(binary, 'binary').toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    const parsed = await parseFoodFromImage(dataUrl);

    let menuItemId: string | undefined;
    try {
      const existing = await prisma.menuItem.findFirst({
        where: {
          userId: session.user.id,
          name: parsed.name,
        },
      });
      if (existing) {
        menuItemId = existing.id;
        parsed.carbsPer100g = existing.carbsPer100g;
        if (existing.proteinPer100g != null) {
          parsed.proteinPer100g = existing.proteinPer100g;
        }
        if (existing.fatPer100g != null) {
          parsed.fatPer100g = existing.fatPer100g;
        }
      }
    } catch (e) {
      console.error('Error overriding image macros from menu:', e);
    }

    if (!Number.isFinite(parsed.carbsPer100g) || parsed.carbsPer100g < 0) {
      return NextResponse.json(
        { error: 'У продукта нет корректных данных по углеводам на 100г' },
        { status: 422 }
      );
    }

    const food = {
      name: parsed.name,
      carbsPer100g: parsed.carbsPer100g,
      weightGrams: parsed.weightGrams,
      proteinPer100g: parsed.proteinPer100g ?? 0,
      fatPer100g: parsed.fatPer100g ?? 0,
      ...(parsed.sugarsPer100g !== undefined && {
        sugarsPer100g: parsed.sugarsPer100g,
      }),
      menuItemId,
    };

    return NextResponse.json({ food, menuItemId });
  } catch (error) {
    console.error('[parse-food-image]', error);
    return NextResponse.json(
      {
        error: 'Не удалось распознать еду по фото',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
