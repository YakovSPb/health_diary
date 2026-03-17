export interface FoodSearchResult {
  name: string;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  /** Сахар на 100 г (г). Если продукт содержит добавленный сахар или много простых углеводов — заполняется DeepSeek. */
  sugarsPer100g?: number;
}

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

/** Запрос БЖУ продукта через DeepSeek API. Возвращает результат или null. */
export async function searchDeepSeek(query: string): Promise<FoodSearchResult | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const { url, model } = getDeepSeekConfig();

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[DeepSeek] Пропуск: DEEPSEEK_API_KEY не задан в .env. Добавьте ключ для поиска БЖУ по базе.');
    }
    return null;
  }

  const prompt = `Для продукта или блюда «${query.trim()}» укажи БЖУ на 100 грамм и наличие сахара. Ответь только одним валидным JSON-объектом без markdown и без пояснений, в формате: {"name": "название продукта", "carbsPer100g": число, "proteinPer100g": число, "fatPer100g": число, "sugarsPer100g": число}. Все числа — только цифры (можно с точкой), без единиц измерения. sugarsPer100g — содержание сахара на 100 г в граммах (если в продукте есть добавленный сахар или много простых углеводов, укажи значение; если нет или не применимо — 0). Если не уверен — дай разумную оценку.`;

  if (process.env.NODE_ENV === 'development') {
    console.info('[DeepSeek] Запрос:', url, 'модель:', model, 'запрос:', query.slice(0, 50));
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const errText = await res.text();
    if (!res.ok) {
      console.error('[DeepSeek] HTTP', res.status, errText.slice(0, 400));
      return null;
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(errText) as typeof data;
    } catch {
      console.error('[DeepSeek] Ответ не JSON:', errText.slice(0, 200));
      return null;
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.error('[DeepSeek] Пустой content в ответе');
      return null;
    }

    let jsonStr = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const braceStart = jsonStr.indexOf('{');
    if (braceStart >= 0) {
      const braceEnd = jsonStr.lastIndexOf('}');
      if (braceEnd > braceStart) jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[DeepSeek] Не удалось распарсить JSON из ответа:', jsonStr.slice(0, 200));
      return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;

    const obj = parsed as Record<string, unknown>;
    const name =
      String(obj.name ?? obj.product_name ?? obj.название ?? query).trim() || query.trim();
    const carbs = Number(obj.carbsPer100g ?? obj.carbs ?? obj.углеводы ?? 0);
    const protein = Number(obj.proteinPer100g ?? obj.protein ?? obj.белки ?? 0);
    const fat = Number(obj.fatPer100g ?? obj.fat ?? obj.жиры ?? 0);
    const sugars = Number(obj.sugarsPer100g ?? obj.sugars ?? obj.сахар ?? 0);

    if (Number.isNaN(carbs) && Number.isNaN(protein) && Number.isNaN(fat)) {
      console.error('[DeepSeek] В ответе нет числовых БЖУ:', content.slice(0, 150));
      return null;
    }

    return {
      name,
      carbsPer100g: Math.max(0, Number.isNaN(carbs) ? 0 : carbs),
      proteinPer100g: Math.max(0, Number.isNaN(protein) ? 0 : protein),
      fatPer100g: Math.max(0, Number.isNaN(fat) ? 0 : fat),
      ...(Number.isNaN(sugars) ? {} : { sugarsPer100g: Math.max(0, sugars) }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DeepSeek] Ошибка:', msg);
    return null;
  }
}

const FOOD_PARSING_PROMPT = `Ты — эксперт по пищевой ценности продуктов. Твоя задача — извлечь из текста название продукта, его вес и предоставить информацию об углеводах на 100г.

Примеры входных данных:
- "150 г яблока гала"
- "яблоко гала 150г"
- "200 грамм гречки вареной"
- "молоко 3.2% 250мл"

ВАЖНО: Отвечай ТОЛЬКО в формате JSON без дополнительного текста:
{
  "name": "название продукта",
  "weightGrams": число (вес в граммах, если указан в мл - преобразуй, считая что 1мл = 1г),
  "carbsPer100g": число (углеводы на 100г продукта),
  "proteinPer100g": число (белки на 100г, опционально),
  "fatPer100g": число (жиры на 100г, опционально),
  "sugarsPer100g": число (сахар на 100г в граммах; если продукт с добавленным сахаром или много простых углеводов — укажи значение, иначе 0)
}

Если не можешь найти информацию об углеводах, используй среднее значение для этого типа продукта.`;

const FOOD_IMAGE_PARSING_PROMPT = `Ты — эксперт по пищевой ценности продуктов. Пользователь присылает фотографию тарелки с едой.

Твоя задача:
- по фото оценить, что это за еда (главный продукт или блюдо) и примерный вес порции в граммах;
- для распознанного продукта вернуть БЖУ на 100 г (ориентируйся на типичные значения для этого продукта);
- ВСЕГДА возвращать название продукта ("name") НА РУССКОМ ЯЗЫКЕ.

Если на тарелке несколько продуктов, выбери основной (по количеству) и оцени его вес. Ответь ТОЛЬКО одним JSON-объектом без пояснений:
{
  "name": "название продукта",
  "weightGrams": число,
  "carbsPer100g": число,
  "proteinPer100g": число,
  "fatPer100g": число,
  "sugarsPer100g": число (сахар на 100 г; если не применимо — 0)
}`;

/** Распознавание еды по фото. Как в diabalance: endpoint с vision (OpenAI или GitHub inference), модель gpt-4o-mini. */
export async function parseFoodFromImage(
  imageDataUrl: string
): Promise<ParsedFood> {
  const apiKey =
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();
  const { url, baseUrl } = getDeepSeekConfig();

  if (!apiKey) {
    throw new Error(
      'Не задан ключ API. Укажите DEEPSEEK_API_KEY в .env (для GitHub inference — ключ с platform.github.com).'
    );
  }

  const supportsVision =
    baseUrl.includes('openai.com') || baseUrl.includes('github.ai');
  if (!supportsVision) {
    throw new Error(
      'Распознавание по фото требует endpoint с vision. Задайте DEEPSEEK_API_URL на OpenAI (https://api.openai.com/v1) или GitHub inference (https://models.github.ai/inference).'
    );
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: FOOD_IMAGE_PARSING_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Определи по фото основной продукт, оцени вес порции и верни БЖУ на 100 г в формате JSON.',
            },
            {
              type: 'image_url',
              image_url: { url: imageDataUrl, detail: 'low' as const },
            },
          ],
        },
      ],
      max_tokens: 256,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(20000),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error('[DeepSeek parse-food-image] HTTP', res.status, raw.slice(0, 300));
    throw new Error(`Ошибка API: ${res.status}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error('Неверный ответ от API');
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Пустой ответ от API');

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('В ответе нет JSON');

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const weightGrams = Math.max(0, Number(parsed.weightGrams) || 100);
  const carbsPer100g = Math.max(0, Number(parsed.carbsPer100g) || 0);
  const sugars = Number(parsed.sugarsPer100g ?? parsed.sugars ?? 0);

  return {
    name: String(parsed.name ?? 'Продукт').trim() || 'Продукт',
    weightGrams,
    carbsPer100g,
    proteinPer100g: Number(parsed.proteinPer100g) || undefined,
    fatPer100g: Number(parsed.fatPer100g) || undefined,
    ...(Number.isNaN(sugars) ? {} : { sugarsPer100g: Math.max(0, sugars) }),
  };
}

export interface ParsedFood {
  name: string;
  weightGrams: number;
  carbsPer100g: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  /** Сахар на 100 г (г). Заполняется DeepSeek при наличии сахара в продукте. */
  sugarsPer100g?: number;
}

/** Парсит текст вида "150 г яблока гала" через DeepSeek — название, вес, БЖУ на 100г. */
export async function parseFoodFromText(text: string): Promise<ParsedFood> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const { url, model } = getDeepSeekConfig();

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY не задан. Добавьте ключ в .env для парсинга продуктов.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: FOOD_PARSING_PROMPT },
        { role: 'user', content: text.trim() },
      ],
      max_tokens: 256,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(15000),
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error('[DeepSeek parse-food] HTTP', res.status, raw.slice(0, 300));
    throw new Error(`Ошибка API: ${res.status}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error('Неверный ответ от API');
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Пустой ответ от API');

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('В ответе нет JSON');

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const sugars = Number(parsed.sugarsPer100g ?? parsed.sugars ?? parsed.сахар ?? 0);
  return {
    name: String(parsed.name ?? text).trim() || text.trim(),
    weightGrams: Math.max(0, Number(parsed.weightGrams) || 100),
    carbsPer100g: Math.max(0, Number(parsed.carbsPer100g) || 0),
    proteinPer100g: Number(parsed.proteinPer100g) || undefined,
    fatPer100g: Number(parsed.fatPer100g) || undefined,
    ...(Number.isNaN(sugars) ? {} : { sugarsPer100g: Math.max(0, sugars) }),
  };
}

const WORKOUT_CALORIES_PROMPT = `Ты — эксперт по расходу калорий при физической нагрузке. По описанию тренировок пользователя оцени СРЕДНИЙ расход дополнительных калорий В ДЕНЬ (ккал/день) — то есть переведи описание в среднее по неделе и выдай ккал в сутки.

Учитывай: частоту (раз в неделю), длительность (часы, минуты), тип нагрузки (силовая, кардио, бег, зал и т.д.). Ответь ТОЛЬКО валидным JSON без markdown и пояснений: {"caloriesPerDay": число}. Число — целое, 0–2000.`;

/**
 * Оценка среднего расхода ккал/день по описанию тренировок через DeepSeek.
 * Возвращает 0 при отсутствии ключа или ошибке.
 */
export async function estimateWorkoutCaloriesFromText(
  text: string
): Promise<number> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const { url, model } = getDeepSeekConfig();

  if (!apiKey || !text.trim()) {
    return 0;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: WORKOUT_CALORIES_PROMPT },
          { role: 'user', content: text.trim() },
        ],
        max_tokens: 128,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error('[DeepSeek workout-calories] HTTP', res.status, raw.slice(0, 200));
      return 0;
    }

    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return 0;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return 0;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const value = Number(parsed.caloriesPerDay ?? parsed.calories ?? parsed.kcal ?? 0);
    if (Number.isNaN(value) || value < 0) return 0;
    return Math.min(2000, Math.round(value));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DeepSeek workout-calories]', msg);
    return 0;
  }
}
