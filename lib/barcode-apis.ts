/**
 * Поиск товара по штрихкоду: Роскачество (RSKRF) и Честный ЗНАК.
 * API Роскачества: https://rskrf.ru/rest/1/search/barcode?barcode={barcode}, /product/{id}/
 */

const RSKRF_BASE = 'https://rskrf.ru/rest/1';

export interface BarcodeProduct {
  name: string;
  carbsPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  sugarsPer100g?: number;
}

export type BarcodeSource = 'rskrf' | 'honest_sign';

/** Нормализует штрихкод: только цифры. */
function normalizeBarcode(barcode: string): string {
  return String(barcode).replace(/\D/g, '');
}

/** Из произвольного объекта API извлекает число (в т.ч. из строки). */
function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Из произвольного объекта API извлекает название товара. */
function toStringOrUndefined(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

/**
 * Поиск по штрихкоду в API Роскачества (RSKRF).
 * Эндпоинты: /search/barcode?barcode={barcode}, /product/{productID}/
 */
async function rskrfByBarcode(
  barcode: string
): Promise<{ product: BarcodeProduct; source: 'rskrf' } | null> {
  const code = normalizeBarcode(barcode);
  if (!code || code.length < 8) return null;

  try {
    const searchUrl = `${RSKRF_BASE}/search/barcode?barcode=${encodeURIComponent(code)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!searchRes.ok) return null;

    const searchData = (await searchRes.json()) as Record<string, unknown>;
    const productId =
      typeof (searchData as { id?: number }).id === 'number'
        ? (searchData as { id: number }).id
        : typeof (searchData as { product?: { id?: number } }).product?.id === 'number'
          ? (searchData as { product: { id: number } }).product.id
          : Array.isArray((searchData as { products?: { id: number }[] }).products) &&
              (searchData as { products: { id: number }[] }).products[0]?.id != null
            ? (searchData as { products: { id: number }[] }).products[0].id
            : null;

    let raw: Record<string, unknown>;
    if (productId != null) {
      const productRes = await fetch(`${RSKRF_BASE}/product/${productId}/`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!productRes.ok) return null;
      raw = (await productRes.json()) as Record<string, unknown>;
    } else {
      raw = searchData;
    }

    const name =
      toStringOrUndefined(
        (raw as { name?: unknown }).name ??
          (raw as { title?: unknown }).title ??
          (raw as { product_name?: unknown }).product_name
      ) ?? null;
    if (!name) return null;

    const product: BarcodeProduct = {
      name,
      carbsPer100g: toNumber(
        (raw as { carbs_per_100?: unknown }).carbs_per_100 ??
          (raw as { carbohydrates?: unknown }).carbohydrates ??
          (raw as { carbsPer100g?: unknown }).carbsPer100g
      ),
      proteinPer100g: toNumber(
        (raw as { protein_per_100?: unknown }).protein_per_100 ??
          (raw as { protein?: unknown }).protein ??
          (raw as { proteinPer100g?: unknown }).proteinPer100g
      ),
      fatPer100g: toNumber(
        (raw as { fat_per_100?: unknown }).fat_per_100 ??
          (raw as { fat?: unknown }).fat ??
          (raw as { fatPer100g?: unknown }).fatPer100g
      ),
      sugarsPer100g: toNumber(
        (raw as { sugars_per_100?: unknown }).sugars_per_100 ??
          (raw as { sugars?: unknown }).sugars ??
          (raw as { sugarsPer100g?: unknown }).sugarsPer100g
      ),
    };
    return { product, source: 'rskrf' };
  } catch {
    return null;
  }
}

/**
 * Честный ЗНАК — API маркировки. Работает с кодами Data Matrix; при наличии API по EAN/GTIN — подставить вызов сюда.
 */
export async function honestSignByBarcode(
  _barcode: string
): Promise<{ product: BarcodeProduct; source: 'honest_sign' } | null> {
  const code = normalizeBarcode(_barcode);
  if (!code || code.length < 8) return null;
  // TODO: при наличии доступа к API Честный ЗНАК по EAN/GTIN — вызвать здесь
  return null;
}

/**
 * Ищет товар по штрихкоду: сначала Роскачество (RSKRF), затем Честный ЗНАК.
 */
export async function findProductByBarcode(
  barcode: string
): Promise<{ product: BarcodeProduct; source: BarcodeSource } | null> {
  const code = normalizeBarcode(barcode);
  if (!code || code.length < 8) return null;
  try {
    const rskrf = await rskrfByBarcode(code);
    if (rskrf?.product?.name) return rskrf;
    const honest = await honestSignByBarcode(code);
    if (honest?.product?.name) return honest;
  } catch {
    // ignore
  }
  return null;
}
