import { getWearableUserId } from '@/lib/wearable-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const userId = await getWearableUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const type = searchParams.get('type');

    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const where: { userId: string; date?: { gte?: Date; lte?: Date }; type?: string } = {
      userId,
    };
    if (from) where.date = { ...where.date, gte: from };
    if (to) where.date = { ...where.date, lte: to };
    if (type) where.type = type;

    const data = await prisma.wearableData.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 1000,
    });

    return NextResponse.json({
      data: data.map((r) => ({
        id: r.id,
        type: r.type,
        value: r.value,
        unit: r.unit,
        date: r.date.toISOString(),
        source: r.source,
      })),
    });
  } catch (error) {
    console.error('Wearable data GET error:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении данных' },
      { status: 500 }
    );
  }
}
