import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const DEFAULT_DEEPSEEK_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const OPENAI_COMPAT_MODEL = 'gpt-4o-mini';

function getDeepSeekConfig() {
  const baseUrl = (process.env.DEEPSEEK_API_URL ?? DEFAULT_DEEPSEEK_URL).replace(/\/$/, '');
  const explicitModel = process.env.DEEPSEEK_MODEL?.trim();
  const model =
    explicitModel ||
    (baseUrl.includes('openai.com') ? OPENAI_COMPAT_MODEL : DEFAULT_DEEPSEEK_MODEL);
  const url =
    baseUrl.includes('github.ai')
      ? `${baseUrl}/chat/completions`
      : baseUrl.includes('/v1')
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/v1/chat/completions`;
  return { baseUrl, model, url };
}

const parseRecipeSchema = z.object({
  text: z.string().min(1).max(10000),
});

const RECIPE_PARSING_PROMPT = `Ты — эксперт по пищевой ценности. Пользователь присылает список ингредиентов блюда (с граммами/штуками/мл).

Твоя задача:
- придумать короткое название блюда (по-русски), опираясь на ингредиенты;
- оценить БЖУ на 100 грамм готового блюда (углеводы, белки, жиры).

Ответь ТОЛЬКО одним валидным JSON-объектом без markdown и без пояснений:
{
  "name": "название блюда",
  "carbsPer100g": число,
  "proteinPer100g": число,
  "fatPer100g": число
}

Требования:
- числа только в виде цифр (можно с точкой), без единиц измерения;
- значения неотрицательные, реалистичные;
- если состав неясен — дай разумную оценку по типу блюда.`;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = parseRecipeSchema.parse(body);

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY не задан. Нужен для расчёта рецептов.' },
        { status: 500 }
      );
    }

    const { url, model } = getDeepSeekConfig();

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: RECIPE_PARSING_PROMPT },
          { role: 'user', content: validated.text.trim() },
        ],
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20000),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error('[parse-recipe] HTTP', res.status, raw.slice(0, 300));
      return NextResponse.json(
        { error: 'Failed to parse recipe', message: `Ошибка API: ${res.status}` },
        { status: 500 }
      );
    }

    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to parse recipe', message: 'Пустой ответ от API' },
        { status: 500 }
      );
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to parse recipe', message: 'В ответе нет JSON' },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const name = String(parsed.name ?? 'Домашнее блюдо').trim() || 'Домашнее блюдо';
    const carbsPer100g = Math.max(0, Number(parsed.carbsPer100g ?? parsed.carbs ?? 0) || 0);
    const proteinPer100g = Math.max(0, Number(parsed.proteinPer100g ?? parsed.protein ?? 0) || 0);
    const fatPer100g = Math.max(0, Number(parsed.fatPer100g ?? parsed.fat ?? 0) || 0);

    return NextResponse.json({
      recipe: {
        name,
        carbsPer100g,
        proteinPer100g,
        fatPer100g,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error parsing recipe:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse recipe',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

