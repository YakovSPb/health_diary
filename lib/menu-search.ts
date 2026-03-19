const STOP_WORDS = new Set<string>(['в', 'на', 'под', 'и', 'с', 'без', 'для', 'но', 'а']);

/** Группы стемов, считающихся эквивалентными при поиске по рецептам (диктовка vs написанное). */
const RECIPE_STEM_EQUIVALENTS: string[][] = [
  ['слив', 'сливоч', 'сливочн'],
  ['масл'],
  ['мук', 'муки'],
  ['рисов', 'рис'],
  ['пшенич', 'пшеничн'],
  ['яйц', 'яич'],
  ['молоч', 'молок'],
  ['сахар'],
  ['сол'],
  ['творож', 'творог'],
  ['сметан'],
  ['овощ', 'овощн'],
  ['помидор', 'помидорн'],
  ['огурц', 'огурч'],
  ['лук', 'луков'],
  ['чеснок', 'чесноч'],
  ['перец', 'перч'],
  ['морков', 'морковн'],
  ['картош', 'картофел'],
  ['куриц', 'курин'],
  ['мяс', 'мясн'],
  ['рыб'],
  ['сыр'],
  ['кефир', 'кефирн'],
  ['банан', 'бананов'],
  ['яблок', 'яблоч'],
  ['лимон', 'лимонн'],
  ['шоколад', 'шоколадн'],
  ['какао'],
  ['мед', 'медов'],
  ['ванил', 'ванильн'],
  ['кориц', 'коричн'],
  ['имбир', 'имбирн'],
];

/** Минимальная длина стема для учёта совпадения по префиксу (избегаем ложных совпадений). */
const MIN_STEM_PREFIX_LEN = 3;

/**
 * Окончания, характерные исключительно для прилагательных.
 * Используются для отсева ложных prefix-совпадений стемов:
 * «сырые».startsWith(«сыр») истинно, но «сырые» — прилагательное, а не форма слова «сыр».
 */
const ADJECTIVE_SUFFIXES = new Set([
  'ые', 'ие', 'ой', 'ая', 'ое', 'ого', 'ому', 'ую', 'ых', 'ым', 'ими',
]);

function stemMatchesForRecipe(queryStem: string, itemStemSet: Set<string>): boolean {
  if (itemStemSet.has(queryStem)) return true;
  for (const group of RECIPE_STEM_EQUIVALENTS) {
    if (!group.includes(queryStem)) continue;
    if (group.some((s) => itemStemSet.has(s))) return true;
  }
  if (queryStem.length >= MIN_STEM_PREFIX_LEN) {
    for (const itemStem of itemStemSet) {
      if (itemStem.length >= MIN_STEM_PREFIX_LEN) {
        if (itemStem.startsWith(queryStem)) {
          const suffix = itemStem.slice(queryStem.length);
          if (!ADJECTIVE_SUFFIXES.has(suffix)) return true;
        } else if (queryStem.startsWith(itemStem)) {
          return true;
        }
      }
    }
  }
  return false;
}

interface PreparedTokens {
  normalized: string;
  tokens: string[];
  stems: string[];
  phoneticKeys: string[];
  bigrams: string[];
  hasTokens: boolean;
}

export function normalizeRussianText(input: string): string {
  const lower = input.toLowerCase();
  const replaced = lower.replace(/ё/g, 'е');
  return replaced.replace(/[^a-zа-я0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function translitToRu(input: string): string {
  if (!/[a-z]/i.test(input)) {
    return input;
  }

  const s = input.toLowerCase();
  let result = '';
  let i = 0;

  const multiMap: Record<string, string> = {
    shch: 'щ',
    sch: 'щ',
    yo: 'ё',
    jo: 'ё',
    yu: 'ю',
    ju: 'ю',
    ya: 'я',
    ja: 'я',
    kh: 'х',
    zh: 'ж',
    ch: 'ч',
    sh: 'ш',
    ts: 'ц',
  };

  const singleMap: Record<string, string> = {
    a: 'а',
    b: 'б',
    v: 'в',
    g: 'г',
    d: 'д',
    e: 'е',
    z: 'з',
    i: 'и',
    y: 'й',
    k: 'к',
    l: 'л',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    r: 'р',
    s: 'с',
    t: 'т',
    u: 'у',
    f: 'ф',
    h: 'х',
    c: 'к',
    q: 'к',
    w: 'в',
    x: 'кс',
  };

  while (i < s.length) {
    let matched = false;
    for (let len = 4; len >= 2; len -= 1) {
      const chunk = s.slice(i, i + len);
      const mapped = multiMap[chunk];
      if (mapped) {
        result += mapped;
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const ch = s[i];
    const single = singleMap[ch];
    if (single) {
      result += single;
    } else {
      result += ch;
    }
    i += 1;
  }

  return result;
}

export function simpleRussianStem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;

  if (w.length > 4 && w.endsWith('ец')) {
    w = w.slice(0, -3) + 'ц';
  }

  const suffixes = [
    'ами',
    'ями',
    'его',
    'ого',
    'ему',
    'ому',
    'ией',
    'иям',
    'иях',
    'ах',
    'ях',
    'ов',
    'ев',
    'ей',
    'ам',
    'ям',
    'ем',
    'ом',
    'ым',
    'им',
    'ой',
    'ей',
    'ий',
    'ый',
    'ою',
    'ею',
    'ую',
    'юю',
    'ью',
    'ия',
    'ие',
    'ые',
    'ин',
    'ын',
    'ок',
    'ек',
    'ик',
    'а',
    'я',
    'ы',
    'и',
    'е',
    'о',
    'у',
    'ю',
  ];

  // «Сырые» (прилагательное, «raw») не должно стемироваться до «сыр» (существительное, «cheese»).
  // Если заблокировать «ые», цикл доходит до «е» и даёт «сыры», которое по префиксу всё равно
  // совпадает с «сыр». Ранний возврат предотвращает любое срезание суффиксов у коротких «…ые».
  if (w.endsWith('ые') && w.length <= 5) return w;

  for (const suf of suffixes) {
    if (w.length > suf.length + 2 && w.endsWith(suf)) {
      return w.slice(0, -suf.length);
    }
  }

  return w;
}

export function phoneticKey(word: string): string {
  const map: Record<string, string> = {
    п: 'б',
    б: 'б',
    т: 'д',
    д: 'д',
    к: 'г',
    г: 'г',
    ф: 'в',
    в: 'в',
    с: 'з',
    з: 'з',
    ш: 'ш',
    ж: 'ш',
    ч: 'ш',
    щ: 'ш',
  };

  let result = '';
  for (const ch of word) {
    const mapped = map[ch];
    result += mapped ?? ch;
  }
  return result;
}

function buildBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

function prepareTokens(input: string): PreparedTokens {
  const normalized = normalizeRussianText(input);
  const rawTokens = normalized.split(/\s+/).filter(Boolean);

  const tokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const stems = tokens.map((t) => simpleRussianStem(t));
  const phoneticKeys = stems.map((s) => phoneticKey(s));
  const bigrams = buildBigrams(stems);

  return {
    normalized,
    tokens,
    stems,
    phoneticKeys,
    bigrams,
    hasTokens: stems.length > 0,
  };
}

export type PreparedQuery = PreparedTokens;

export function prepareSearchQuery(rawQuery: string): PreparedQuery {
  const withTranslit = translitToRu(rawQuery);
  return prepareTokens(withTranslit);
}

export interface ScoreMenuItemOptions {
  /** Учитывать эквиваленты стемов — для поиска по тексту рецепта. */
  recipeStemEquivalents?: boolean;
}

export function scoreMenuItem(query: PreparedQuery, itemName: string, options?: ScoreMenuItemOptions): number {
  if (!itemName) return 0;

  const itemPrepared = prepareTokens(itemName);
  const itemStemSet = new Set(itemPrepared.stems);
  const useEquivalents = options?.recipeStemEquivalents === true;
  const stemMatch = (stem: string) =>
    useEquivalents ? stemMatchesForRecipe(stem, itemStemSet) : itemStemSet.has(stem);

  if (!query.hasTokens) {
    if (!query.normalized) return 0;
    if (itemPrepared.normalized.includes(query.normalized) || query.normalized.includes(itemPrepared.normalized)) {
      return 1;
    }
    return 0;
  }

  let score = 0;

  if (itemPrepared.normalized === query.normalized) {
    score += 1000;
  }

  // +500 только если все токены запроса присутствуют как целые слова в названии блюда.
  // Substring-проверка («сыр» внутри «сырые») намеренно исключена.
  const allQueryTokensInItem = query.tokens.every((qt) => itemPrepared.tokens.includes(qt));
  const itemTokensSubsetOfQuery = itemPrepared.tokens.every((it) => query.tokens.includes(it));
  if (allQueryTokensInItem || itemTokensSubsetOfQuery) {
    score += 500;
  }

  const itemPhonSet = new Set(itemPrepared.phoneticKeys);
  const itemBigramSet = new Set(itemPrepared.bigrams);

  if (query.stems.length > 1) {
    for (const stem of query.stems) {
      if (!stemMatch(stem)) {
        return 0;
      }
    }
  } else if (query.stems.length === 1) {
    // Для однословного запроса требуем точное совпадение стема — без prefix-матча и substring.
    // Это исключает ложные совпадения типа «сыр» → «сырые».
    if (!stemMatch(query.stems[0])) {
      return 0;
    }
  }

  const exactTokenMatches = query.stems.length;

  if (query.stems.length >= 2) {
    score += 80;
  }

  let phoneticMatches = 0;
  for (const stem of query.stems) {
    const key = phoneticKey(stem);
    if (itemPhonSet.has(key) && !itemStemSet.has(stem)) {
      phoneticMatches += 1;
    }
  }

  let bigramMatches = 0;
  for (const bg of query.bigrams) {
    if (itemBigramSet.has(bg)) {
      bigramMatches += 1;
    }
  }

  if (bigramMatches > 0) {
    score += bigramMatches * 50;
  }
  if (exactTokenMatches > 0) {
    score += exactTokenMatches * 30;
  }
  if (phoneticMatches > 0) {
    score += phoneticMatches * 10;
  }

  if (score === 0) return 0;

  return score;
}

export function scoreMenuItemWithRecipe(
  query: PreparedQuery,
  name: string,
  recipeText: string | null | undefined
): number {
  const byName = scoreMenuItem(query, name ?? '', { recipeStemEquivalents: true });
  const byRecipe = recipeText?.trim()
    ? scoreMenuItem(query, recipeText.trim(), { recipeStemEquivalents: true })
    : 0;
  return Math.max(byName, byRecipe);
}

