import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parseFoodFromText } from '@/lib/deepseek-search';
import { z } from 'zod';

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
});

/** POST /api/parse-food — распарсить текст продукта через DeepSeek (как в diabalance). */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text } = bodySchema.parse(body);

    const parsedFood = await parseFoodFromText(text);
    return NextResponse.json({ food: parsedFood });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('[parse-food]', error);
    return NextResponse.json(
      {
        error: 'Failed to parse food',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
