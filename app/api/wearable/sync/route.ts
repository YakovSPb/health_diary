import { getWearableUserId } from '@/lib/wearable-auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const SOURCE = 'samsung_health';

const wearableRecordSchema = z.object({
  type: z.enum([
    'steps',
    'sleep_minutes',
    'heart_rate',
    'weight',
    'blood_oxygen',
    'active_calories',
    'floors_climbed',
    'body_temperature',
    'stress',
    'water_ml',
  ]),
  value: z.number().finite(),
  unit: z.string().max(20).optional(),
  date: z.string().datetime(),
});

const syncBodySchema = z.object({
  data: z.array(wearableRecordSchema).min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const userId = await getWearableUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = syncBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const created = await prisma.wearableData.createMany({
      data: parsed.data.data.map((r) => ({
        userId,
        type: r.type,
        value: r.value,
        unit: r.unit ?? null,
        date: new Date(r.date),
        source: SOURCE,
      })),
    });

    return NextResponse.json({ success: true, count: created.count }, { status: 201 });
  } catch (error) {
    console.error('Wearable sync error:', error);
    return NextResponse.json(
      { error: 'Ошибка при сохранении данных' },
      { status: 500 }
    );
  }
}
