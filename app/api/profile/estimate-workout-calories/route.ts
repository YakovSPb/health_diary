import { estimateWorkoutCaloriesFromText } from '@/lib/deepseek-search';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const body = await req.json();
    const text = typeof body?.workouts === 'string' ? body.workouts.trim() : '';
    if (!text) {
      return NextResponse.json({ caloriesPerDay: 0 });
    }

    const caloriesPerDay = await estimateWorkoutCaloriesFromText(text);
    return NextResponse.json({ caloriesPerDay });
  } catch (error) {
    console.error('[estimate-workout-calories]', error);
    return NextResponse.json(
      { error: 'Ошибка при оценке калорий' },
      { status: 500 }
    );
  }
}
