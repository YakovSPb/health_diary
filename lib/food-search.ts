import type { PrismaClient } from '@prisma/client';
import {
  getQueryWords,
  getDishWords,
  getShingles,
  wordsMatchPhonetic,
} from '@/lib/voice-search-normalize';

export interface FoodSearchResult {
  name: string;
  carbsPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  /** Сахар на 100 г (из DeepSeek). В меню не хранится. */
  sugarsPer100g?: number;
}

interface ScoredItem {
  item: { name: string; carbsPer100g: number; proteinPer100g: number; fatPer100g: number };
  score: number;
  exactMatches: number;
  phoneticMatches: number;
}

/**
 * Подсчёт релевантности: точные совпадения слов, фонетические, пересечение шинглов.
 * Выше в списке — больше точных, ниже — только фонетика.
 */
function scoreDish(
  queryWords: string[],
  queryShingles: Set<string>,
  dishWords: string[],
  dishShingles: Set<string>
): { score: number; exactMatches: number; phoneticMatches: number } {
  let exactMatches = 0;
  let phoneticMatches = 0;

  for (const qw of queryWords) {
    const exact = dishWords.some((dw) => dw === qw);
    if (exact) {
      exactMatches += 1;
      continue;
    }
    const phonetic = dishWords.some((dw) => wordsMatchPhonetic(qw, dw));
    if (phonetic) phoneticMatches += 1;
  }

  let shingleScore = 0;
  for (const sq of queryShingles) {
    if (dishShingles.has(sq)) shingleScore += 2;
  }
  for (const dq of dishShingles) {
    if (queryShingles.has(dq)) shingleScore += 2;
  }
  shingleScore = Math.min(shingleScore / 2, queryShingles.size + dishShingles.size);

  const score =
    exactMatches * 10 + phoneticMatches * 4 + shingleScore;
  return { score, exactMatches, phoneticMatches };
}

/**
 * Поиск блюд в меню по запросу с нормализацией для голосового набора.
 * Возвращает список, отсортированный по релевантности (сначала точные, затем фонетические).
 */
export async function searchInMenu(
  prisma: PrismaClient,
  userId: string,
  query: string
): Promise<FoodSearchResult[]> {
  const queryWords = getQueryWords(query);
  if (queryWords.length === 0) return [];

  const all = await prisma.menuItem.findMany({
    where: { userId },
    orderBy: [{ name: 'asc' }],
  });

  const queryShingles = getShingles(queryWords);
  const scored: ScoredItem[] = [];

  for (const i of all) {
    const dishWords = getDishWords(i.name);
    if (dishWords.length === 0) continue;

    const dishShingles = getShingles(dishWords);
    const { score, exactMatches, phoneticMatches } = scoreDish(
      queryWords,
      queryShingles,
      dishWords,
      dishShingles
    );

    const shingleOverlap =
      [...queryShingles].some((sq) => dishShingles.has(sq)) ||
      [...dishShingles].some((dq) => queryShingles.has(dq));
    const hasMatch = exactMatches > 0 || phoneticMatches > 0 || shingleOverlap;
    const allDishWordsCovered = dishWords.every((dw) =>
      queryWords.some((qw) => dw === qw || wordsMatchPhonetic(qw, dw))
    );
    if (!hasMatch || !allDishWordsCovered) continue;
    if (score <= 0) continue;

    scored.push({
      item: {
        name: i.name,
        carbsPer100g: i.carbsPer100g,
        proteinPer100g: i.proteinPer100g ?? 0,
        fatPer100g: i.fatPer100g ?? 0,
      },
      score,
      exactMatches,
      phoneticMatches,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.exactMatches - a.exactMatches || b.phoneticMatches - a.phoneticMatches;
  });

  return scored.map((s) => ({
    name: s.item.name,
    carbsPer100g: s.item.carbsPer100g,
    proteinPer100g: s.item.proteinPer100g,
    fatPer100g: s.item.fatPer100g,
  }));
}

import { searchDeepSeek } from '@/lib/deepseek-search';

function hasBju(data: FoodSearchResult): boolean {
  return (
    data.carbsPer100g > 0 ||
    data.proteinPer100g > 0 ||
    data.fatPer100g > 0
  );
}

/** Сначала ищет в меню (первый по релевантности), затем через DeepSeek API. */
export async function findFood(
  prisma: PrismaClient,
  userId: string,
  query: string
): Promise<{ result: FoodSearchResult; source: 'menu' | 'internet' } | null> {
  const menuResults = await searchInMenu(prisma, userId, query);
  const menuResult = menuResults[0] ?? null;
  if (menuResult && hasBju(menuResult)) return { result: menuResult, source: 'menu' };

  const deepSeekResult = await searchDeepSeek(query);
  if (deepSeekResult) return { result: deepSeekResult, source: 'internet' };

  if (menuResult) return { result: menuResult, source: 'menu' };
  return null;
}
