/**
 * Нормализация запроса для голосового поиска по блюдам:
 * нижний регистр, ё→е, пунктуация, стоп-слова, морфология, фонетика, транслит, шинглы.
 */

const STOP_WORDS = new Set([
  'в',
  'на',
  'под',
  'и',
  'с',
  'з',
  'со',
  'без',
  'для',
  'но',
  'а',
]);

/** Приведение к нижнему регистру, ё→е, удаление знаков препинания. */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Удалить стоп-слова из массива слов. */
export function removeStopWords(words: string[]): string[] {
  return words.filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

/**
 * Упрощённое приведение к начальной форме (им. п., ед. ч.).
 * Эвристики для типичных окончаний существительных и прилагательных.
 */
export function lemmatizeWord(word: string): string {
  if (word.length < 3) return word;

  const w = word;

  // Ед. ч. «яйцо» → «яйца» (часто в меню во мн. ч.; голос даёт «яйцо вареное»)
  if (w === 'яйцо') return 'яйца';

  // Прилагательные: варёный/вареное/варёные → основа (голос часто «вареное»)
  if (w.length >= 5) {
    if (w.endsWith('енное')) return w.slice(0, -5) + 'ен';
    if (w.endsWith('еное')) return w.slice(0, -4) + 'ен';
    if (w.endsWith('енные')) return w.slice(0, -5) + 'ен';
    if (w.endsWith('еные')) return w.slice(0, -4) + 'ен';
    if (w.endsWith('енный')) return w.slice(0, -5) + 'ен';
    if (w.endsWith('еный')) return w.slice(0, -4) + 'ен';
  }

  // Ж.р. -а: сметана → сметаной, сметаны, сметану
  if (w.endsWith('ой') && w.length >= 4) return w.slice(0, -2) + 'а';
  if (w.endsWith('ей') && w.length >= 4) return w.slice(0, -2) + 'я';
  if (w.endsWith('ую') && w.length >= 4) return w.slice(0, -2) + 'а';
  if (w.endsWith('юю') && w.length >= 4) return w.slice(0, -2) + 'я';
  if (w.endsWith('ы') && w.length >= 4 && !w.endsWith('цы')) return w.slice(0, -1) + 'а';
  if (w.endsWith('и') && w.length >= 4 && !['щи', 'чи', 'жи', 'ши'].some((s) => w.endsWith(s)))
    return w.slice(0, -1) + 'а';
  if (w.endsWith('у') && w.length >= 4) return w.slice(0, -1) + 'а';
  if (w.endsWith('ю') && w.length >= 4) return w.slice(0, -1) + 'я';
  if (w.endsWith('е') && w.length >= 4) return w.slice(0, -1) + 'я'; // кофе исключение позже

  // М.р. - Consonant: борщ, суп (без окончания)
  if (w.endsWith('ом') && w.length >= 5) return w.slice(0, -2);
  if (w.endsWith('ем') && w.length >= 5) return w.slice(0, -2);
  if (w.endsWith('ам') && w.length >= 5) return w.slice(0, -2);
  if (w.endsWith('им') && w.length >= 5) return w.slice(0, -2);
  if (w.endsWith('ём') && w.length >= 5) return w.slice(0, -2);

  // Мн. ч. → ед. (ы → а уже выше)
  if (w.endsWith('ки') && w.length >= 5) return w.slice(0, -2) + 'ка';
  if (w.endsWith('ки') && w.length >= 4) return w.slice(0, -2) + 'ок';

  return w;
}

/** Таблица транслитерации латиница → кириллица (для типичных запросов). */
const TRANSLIT_MAP: Record<string, string> = {
  a: 'а',
  b: 'б',
  v: 'в',
  g: 'г',
  d: 'д',
  e: 'е',
  yo: 'ё',
  zh: 'ж',
  z: 'з',
  i: 'и',
  j: 'й',
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
  ts: 'ц',
  ch: 'ч',
  sh: 'ш',
  shch: 'щ',
  '’': 'ь',
  y: 'ы',
  eh: 'э',
  yu: 'ю',
  ya: 'я',
};

/** Конвертирует латинские символы в кириллицу (shaurma → шаурма). */
export function translitToCyrillic(str: string): string {
  let result = '';
  let i = 0;
  const s = str.toLowerCase();
  while (i < s.length) {
    let found = false;
    for (const len of [4, 3, 2, 1]) {
      const chunk = s.slice(i, i + len);
      const mapped = TRANSLIT_MAP[chunk];
      if (mapped !== undefined) {
        result += mapped;
        i += len;
        found = true;
        break;
      }
    }
    if (!found) {
      result += s[i];
      i += 1;
    }
  }
  return result;
}

/** Проверяет, есть ли в строке латинские буквы (нужен ли транслит). */
function hasLatin(s: string): boolean {
  return /[a-zA-Z]/.test(s);
}

/** Пары глухой/звонкий и гласные и/е — приводим к одному символу для сравнения. */
const PHONETIC_GROUPS: Record<string, string> = {
  п: 'п',
  б: 'п',
  т: 'т',
  д: 'т',
  к: 'к',
  г: 'к',
  ф: 'ф',
  в: 'ф',
  с: 'с',
  з: 'с',
  ш: 'ш',
  ж: 'ш',
  щ: 'ш',
  ч: 'ч',
  и: 'е',
  е: 'е',
};

/** Фонетическая подпись слова: замены глухих/звонких и шипящих для сравнения. */
export function phoneticSignature(word: string): string {
  return [...word]
    .map((c) => PHONETIC_GROUPS[c] ?? c)
    .join('');
}

/** Слова совпадают точно или только по фонетике (п-б, т-д, к-г, ф-в, с-з, ш-ж, щ). */
export function wordsMatchPhonetic(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return phoneticSignature(a) === phoneticSignature(b);
}

/** Разбить строку на слова (уже нормализованную), без стоп-слов, с лемматизацией. */
export function getQueryWords(query: string): string[] {
  let text = normalizeQuery(query);
  if (hasLatin(text)) text = translitToCyrillic(text);
  const words = text.split(/\s+/).filter(Boolean);
  const noStop = removeStopWords(words);
  return noStop.map(lemmatizeWord).filter((w) => w.length > 0);
}

/** Биграммы слов для учёта перестановки: "суп куриный" и "куриный суп". */
export function getShingles(words: string[]): Set<string> {
  const shingles = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    shingles.add(words[i]);
    if (i + 1 < words.length) {
      shingles.add(`${words[i]} ${words[i + 1]}`);
    }
  }
  return shingles;
}

/** Нормализованные слова названия блюда (без транслита — названия в базе уже по-русски). */
export function getDishWords(dishName: string): string[] {
  const text = normalizeQuery(dishName);
  const words = text.split(/\s+/).filter(Boolean);
  const noStop = removeStopWords(words);
  return noStop.map(lemmatizeWord).filter((w) => w.length > 0);
}
