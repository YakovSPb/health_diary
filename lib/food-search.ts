import type { PrismaClient } from '@prisma/client';

export interface FoodSearchResult {
  name: string;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  /** Сахар на 100 г (из DeepSeek). В меню не хранится. */
  sugarsPer100g?: number;
}

const MIN_STEM_LEN = 3;

/** Совпадают ли слова по началу (пшеничной/каши ≈ пшеничная/каша). */
function tokensMatchQuery(queryWords: string[], nameWords: string[]): boolean {
  if (queryWords.length === 0) return nameWords.length === 0;
  for (const qw of queryWords) {
    const qStem = qw.slice(0, MIN_STEM_LEN);
    if (!nameWords.some((nw) => nw.slice(0, MIN_STEM_LEN) === qStem || nw.startsWith(qStem) || qw.startsWith(nw.slice(0, MIN_STEM_LEN))))
      return false;
  }
  return true;
}

/** Поиск блюда в меню пользователя по запросу. Возвращает первый подходящий или null. */
export async function searchInMenu(
  prisma: PrismaClient,
  userId: string,
  query: string
): Promise<FoodSearchResult | null> {
  const searchLower = query.trim().toLowerCase();
  if (!searchLower) return null;

  const all = await prisma.menuItem.findMany({
    where: { userId },
    orderBy: [{ name: 'asc' }],
  });

  const queryWords = searchLower.split(/\s+/).filter(Boolean);

  const match = all.find((i) => {
    const nameLower = i.name.toLowerCase();
    if (nameLower.includes(searchLower) || searchLower.includes(nameLower)) return true;
    const nameWords = nameLower.split(/\s+/).filter(Boolean);
    if (queryWords.length > 0 && nameWords.length > 0 && tokensMatchQuery(queryWords, nameWords)) return true;
    return false;
  });
  if (!match) return null;

  return {
    name: match.name,
    carbsPer100g: match.carbsPer100g,
    proteinPer100g: match.proteinPer100g ?? 0,
    fatPer100g: match.fatPer100g ?? 0,
  };
}

import { searchDeepSeek } from '@/lib/deepseek-search';

function hasBju(data: FoodSearchResult): boolean {
  return (
    (data.carbsPer100g > 0 || data.proteinPer100g > 0 || data.fatPer100g > 0)
  );
}

/** Сначала ищет в меню, затем через DeepSeek API (DEEPSEEK_API_KEY, DEEPSEEK_API_URL). */
export async function findFood(
  prisma: PrismaClient,
  userId: string,
  query: string
): Promise<{ result: FoodSearchResult; source: 'menu' | 'internet' } | null> {
  const menuResult = await searchInMenu(prisma, userId, query);
  if (menuResult && hasBju(menuResult)) return { result: menuResult, source: 'menu' };

  const deepSeekResult = await searchDeepSeek(query);
  if (deepSeekResult) return { result: deepSeekResult, source: 'internet' };

  if (menuResult) return { result: menuResult, source: 'menu' };
  return null;
}
