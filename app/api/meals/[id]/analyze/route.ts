import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Ключевые слова для определения овощей
const VEGETABLE_KEYWORDS = [
  'овощ', 'салат', 'огурец', 'помидор', 'томат', 'капуста', 'морковь', 'свёкла', 'редис',
  'перец', 'баклажан', 'кабачок', 'тыква', 'редиска', 'редис', 'лук', 'чеснок', 'зелень',
  'укроп', 'петрушка', 'шпинат', 'руккола', 'брокколи', 'цветная', 'горох', 'фасоль', 'чечевица',
  'редис', 'редиска', 'редис',
];

// Ключевые слова вредной пищи
const JUNK_KEYWORDS = [
  'фастфуд', 'бургер', 'пицца', 'чипсы', 'сухарики', 'кола', 'газировка', 'сникерс', 'марс',
  'шоколад', 'конфет', 'пирожное', 'торт', 'мороженое', 'майонез', 'кетчуп', 'сосиск', 'колбас',
  'жарен', 'фри', 'картофель фри', 'донат', 'пончик', 'чизбургер', 'наггетс', 'хот-дог',
  'печенье', 'вафл', 'булочк', 'сдоб', 'беляш', 'чебурек', 'сахар', 'попкорн',
];

// Ориентировочные нормы за день (для одного приёма — доля от дневной нормы при 4–5 приёмах)
const DAILY_PROTEIN_MIN = 60;   // г
const DAILY_CARBS_MIN = 150;   // г (при похудении можно ниже)
const DAILY_FAT_MIN = 40;      // г
const DAILY_CALORIES_TARGET = 1800; // для похудения ориентир

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mealId } = await params;

    const meal = await prisma.meal.findFirst({
      where: { id: mealId, userId: session.user.id },
      include: { foodItems: { orderBy: { order: 'asc' } } },
    });

    if (!meal) {
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    const { totalProtein, totalCarbs, totalFat, totalCalories, foodItems } = meal;

    // Один приём — примерно 20–25% от дневной нормы (при 4–5 приёмах)
    const perMealShare = 0.22;
    const proteinOk = totalProtein >= DAILY_PROTEIN_MIN * perMealShare;
    const carbsOk = totalCarbs >= DAILY_CARBS_MIN * perMealShare;
    const fatOk = totalFat >= DAILY_FAT_MIN * perMealShare;

    const namesLower = foodItems.map((f) => f.name.toLowerCase());
    const hasVegetables = namesLower.some((name) =>
      VEGETABLE_KEYWORDS.some((kw) => name.includes(kw))
    );
    const junkFound = namesLower.filter((name) =>
      JUNK_KEYWORDS.some((kw) => name.includes(kw))
    );

    const messages: string[] = [];

    if (proteinOk) {
      messages.push(`Белки: достаточно (${totalProtein.toFixed(0)} г в приёме).`);
    } else {
      messages.push(`Белки: мало (${totalProtein.toFixed(0)} г). Рекомендуется добавить белковые продукты.`);
    }

    if (carbsOk) {
      messages.push(`Углеводы: достаточно (${totalCarbs.toFixed(0)} г).`);
    } else {
      messages.push(`Углеводы: мало (${totalCarbs.toFixed(0)} г). Можно добавить крупы или овощи.`);
    }

    if (fatOk) {
      messages.push(`Жиры: достаточно (${totalFat.toFixed(0)} г).`);
    } else {
      messages.push(`Жиры: мало (${totalFat.toFixed(0)} г). Умеренно добавьте орехи, масло, рыбу.`);
    }

    if (hasVegetables) {
      messages.push('Овощи в приёме есть — хорошо.');
    } else {
      messages.push('Овощей в приёме нет. Рекомендуется добавить овощи или зелень.');
    }

    if (junkFound.length > 0) {
      messages.push(`Вредная/калорийная пища: обнаружено — ${junkFound.join(', ')}. Рекомендуется ограничить.`);
    } else {
      messages.push('Вредной пищи в приёме не обнаружено.');
    }

    messages.push(`Калорийность приёма: ${Math.round(totalCalories)} ккал.`);

    return NextResponse.json({
      analysis: messages.join(' '),
      summary: {
        totalProtein: Math.round(totalProtein * 10) / 10,
        totalCarbs: Math.round(totalCarbs * 10) / 10,
        totalFat: Math.round(totalFat * 10) / 10,
        totalCalories: Math.round(totalCalories),
        hasVegetables: hasVegetables,
        hasJunkFood: junkFound.length > 0,
        junkItems: junkFound,
      },
    });
  } catch (error) {
    console.error('Error analyzing meal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
