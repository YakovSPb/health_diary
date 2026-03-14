/**
 * Поиск товара по штрихкоду (EAN-13 и др.) в нескольких источниках по очереди:
 * 1) Честный ЗНАК 2) Меркурий 3) Роскачество (rskrf.ru) 4) ЮНИСКАН/ГС1 (через 1С) 5) Open Food Facts
 */

export interface BarcodeProduct {
  name: string;
  carbsPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  sugarsPer100g?: number;
}

export type BarcodeSource =
  | 'honest_sign'
  | 'mercury'
  | 'roskachestvo'
  | 'uniscan'
  | 'open_food_facts';

const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product';

/** Нормализует штрихкод: только цифры. */
function normalizeBarcode(barcode: string): string {
  return String(barcode).replace(/\D/g, '');
}

/**
 * Честный ЗНАК — API маркировки работает с кодами Data Matrix, не с EAN.
 * Публичного поиска по EAN нет. При появлении endpoint — подставить сюда.
 */
export async function honestSignByBarcode(
  _barcode: string
): Promise<{ product: BarcodeProduct; source: BarcodeSource } | null> {
  const code = normalizeBarcode(_barcode);
  if (!code || code.length < 8) return null;
  // TODO: при наличии доступа к API Честный ЗНАК по EAN/GTIN — вызвать здесь
  return null;
}

/**
 * ФГИС Меркурий — ветеринарные ВСД, не поиск товара по EAN.
 * При появлении публичного API по штрихкоду — подставить.
 */
export async function mercuryByBarcode(
  _barcode: string
): Promise<{ product: BarcodeProduct; source: BarcodeSource } | null> {
  const code = normalizeBarcode(_barcode);
  if (!code || code.length < 8) return null;
  // TODO: при наличии доступа к API Меркурий по штрихкоду — вызвать здесь
  return null;
}

const ROSKACHESTVO_BASE = 'https://rskrf.ru';

/**
 * Роскачество (rskrf.ru) — рейтинги и информация о качестве товаров.
 * Запрос по штрихкоду без переменных окружения.
 */
export async function roskachestvoByBarcode(
  _barcode: string
): Promise<{ product: BarcodeProduct; source: BarcodeSource } | null> {
  const code = normalizeBarcode(_barcode);
  if (!code || code.length < 8) return null;
  try {
    const url = `${ROSKACHESTVO_BASE}/api/product/${code}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; title?: string; productName?: string };
    const name = data.name ?? data.title ?? data.productName;
    if (!name || typeof name !== 'string') return null;
    return {
      product: { name: name.trim() },
      source: 'roskachestvo',
    };
  } catch {
    return null;
  }
}

/**
 * База данных Ассоциации ЮНИСКАН/ГС1 РУС — доступ через 1С (GEPIR/каталоги).
 * Прямого REST API для внешних систем нет; интеграция идёт через 1С:Предприятие.
 * При появлении HTTP-шлюза или API — подставить вызов сюда.
 * Переменная окружения: UNISCAN_API_URL (опционально).
 */
export async function uniscanByBarcode(
  _barcode: string
): Promise<{ product: BarcodeProduct; source: BarcodeSource } | null> {
  const code = normalizeBarcode(_barcode);
  if (!code || code.length < 8) return null;
  const baseUrl = process.env.UNISCAN_API_URL?.trim();
  if (!baseUrl) return null;
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/barcode/${code}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; description?: string; productName?: string };
    const name = data.name ?? data.description ?? data.productName;
    if (!name || typeof name !== 'string') return null;
    return {
      product: { name: name.trim() },
      source: 'uniscan',
    };
  } catch {
    return null;
  }
}

/**
 * Open Food Facts — бесплатный API по штрихкоду (EAN/UPC).
 * Используется как третий источник (Яндекс Маркет по EAN не ищет).
 */
export async function openFoodFactsByBarcode(
  barcode: string
): Promise<{ product: BarcodeProduct; source: BarcodeSource } | null> {
  const code = normalizeBarcode(barcode);
  if (!code || code.length < 8) return null;

  try {
    const url = `${OPEN_FOOD_FACTS_URL}/${code}.json?fields=product_name,brand,nutriments`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        brand?: string;
        nutriments?: {
          carbohydrates_100g?: number;
          proteins_100g?: number;
          fat_100g?: number;
          sugars_100g?: number;
          'energy-kcal_100g'?: number;
        };
      };
    };

    if (data.status !== 1 || !data.product?.product_name) return null;

    const p = data.product;
    const name = [p.brand, p.product_name].filter(Boolean).join(' ') || p.product_name || 'Продукт';
    const nut = p.nutriments ?? {};
    const carbs = nut.carbohydrates_100g ?? 0;
    const protein = nut.proteins_100g ?? 0;
    const fat = nut.fat_100g ?? 0;
    const sugars = nut.sugars_100g;

    return {
      product: {
        name: name.trim(),
        carbsPer100g: Number.isFinite(carbs) ? carbs : 0,
        proteinPer100g: Number.isFinite(protein) ? protein : 0,
        fatPer100g: Number.isFinite(fat) ? fat : 0,
        sugarsPer100g: Number.isFinite(sugars) ? sugars : undefined,
      },
      source: 'open_food_facts',
    };
  } catch {
    return null;
  }
}

const PROVIDERS: Array<
  (barcode: string) => Promise<{ product: BarcodeProduct; source: BarcodeSource } | null>
> = [
  honestSignByBarcode,
  mercuryByBarcode,
  roskachestvoByBarcode,
  uniscanByBarcode,
  openFoodFactsByBarcode,
];

/**
 * Ищет товар по штрихкоду в API по очереди, пока не найдёт.
 * Порядок: Честный ЗНАК → Меркурий → Роскачество → ЮНИСКАН → Open Food Facts.
 */
export async function findProductByBarcode(
  barcode: string
): Promise<{ product: BarcodeProduct; source: BarcodeSource } | null> {
  const code = normalizeBarcode(barcode);
  if (!code || code.length < 8) return null;

  for (const fn of PROVIDERS) {
    try {
      const result = await fn(code);
      if (result?.product?.name) return result;
    } catch {
      // продолжаем со следующим провайдером
    }
  }
  return null;
}
