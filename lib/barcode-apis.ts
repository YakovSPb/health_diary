/**
 * Поиск товара по штрихкоду: Роскачество (RSKRF) и Честный ЗНАК.
 * API Роскачества: https://rskrf.ru/rest/1/search/barcode?barcode={barcode}, /product/{id}/
 */

const RSKRF_BASE = 'https://rskrf.ru/rest/1';

/** User-Agent для внешних API. */
const API_USER_AGENT = 'HealthDiary/1.0 (https://github.com)';

export interface BarcodeProduct {
  name: string;
  carbsPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  sugarsPer100g?: number;
}

export type BarcodeSource = 'rskrf' | 'honest_sign' | 'openfoodfacts';

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
    console.log('[rskrf] search/barcode request:', { barcode: code, url: searchUrl });
    const searchRes = await fetch(searchUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': API_USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
    });
    console.log('[rskrf] search/barcode response meta:', {
      barcode: code,
      status: searchRes.status,
      contentType: searchRes.headers.get('content-type'),
    });
    if (!searchRes.ok) {
      const bodyText = await searchRes.text().catch(() => '');
      console.log('[rskrf] search/barcode не OK:', {
        barcode: code,
        status: searchRes.status,
        bodyText: bodyText || null,
      });
      return null;
    }

    const searchData = (await searchRes.json()) as Record<string, unknown>;
    console.log('[rskrf] search/barcode response:', searchData);
    // Как в diabalance: товар может быть в products, items, result, product или в response
    const productList =
      (searchData as Record<string, unknown>).products ??
      (searchData as Record<string, unknown>).items ??
      (searchData as Record<string, unknown>).result ??
      null;
    const topLevelProduct =
      (Array.isArray(productList) && productList.length > 0 ? productList[0] : null) ??
      (searchData as Record<string, unknown>).product ??
      (searchData as Record<string, unknown>).response;
    const data = (typeof topLevelProduct === 'object' && topLevelProduct !== null
      ? topLevelProduct
      : searchData) as Record<string, unknown>;
    const productId = typeof (data as { id?: number }).id === 'number' ? (data as { id: number }).id : null;

    let raw: Record<string, unknown> = data;
    if (productId != null) {
      const productUrl = `${RSKRF_BASE}/product/${productId}/`;
      console.log('[rskrf] product request:', { barcode: code, productId, url: productUrl });
      const productRes = await fetch(productUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': API_USER_AGENT,
        },
        signal: AbortSignal.timeout(10000),
      });
      console.log('[rskrf] product response meta:', {
        barcode: code,
        productId,
        status: productRes.status,
        contentType: productRes.headers.get('content-type'),
      });
      if (productRes.ok) {
        const productData = (await productRes.json()) as Record<string, unknown>;
        console.log('[rskrf] product response:', productData);
        raw = ((productData.response ?? productData) as Record<string, unknown>) ?? productData;
      } else {
        const bodyText = await productRes.text().catch(() => '');
        console.log('[rskrf] product не OK:', {
          barcode: code,
          productId,
          status: productRes.status,
          bodyText: bodyText || null,
        });
      }
    }

    const name =
      toStringOrUndefined(
        (raw as { title?: unknown }).title ??
          (raw as { name?: unknown }).name ??
          (raw as { product_name_ru?: unknown }).product_name_ru ??
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
  } catch (err) {
    console.error('[rskrf] Ошибка при поиске по штрихкоду:', { barcode: code, err });
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

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2';

/**
 * Поиск по штрихкоду в Open Food Facts (как в diabalance: тот же URL и парсинг).
 */
async function openFoodFactsByBarcode(
  barcode: string
): Promise<{ product: BarcodeProduct; source: 'openfoodfacts' } | null> {
  const code = normalizeBarcode(barcode);
  if (!code || code.length < 8) return null;
  try {
    const url = `${OFF_BASE}/product/${encodeURIComponent(code)}.json`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': API_USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (!data || data.status !== 1 || !data.product) return null;
    const p = data.product as Record<string, unknown>;
    // Как в diabalance: product_name_ru || product_name || generic_name_ru || ...
    const rawName =
      (typeof p.product_name_ru === 'string' && p.product_name_ru.trim()
        ? p.product_name_ru.trim()
        : null) ??
      (typeof p.product_name === 'string' && p.product_name.trim()
        ? p.product_name.trim()
        : null) ??
      (typeof p.generic_name_ru === 'string' && p.generic_name_ru.trim()
        ? p.generic_name_ru.trim()
        : null) ??
      (typeof p.generic_name === 'string' && p.generic_name.trim()
        ? p.generic_name.trim()
        : null) ??
      (typeof p.abbreviated_product_name_ru === 'string' &&
      p.abbreviated_product_name_ru.trim()
        ? p.abbreviated_product_name_ru.trim()
        : null) ??
      (typeof p.abbreviated_product_name === 'string' &&
      p.abbreviated_product_name.trim()
        ? p.abbreviated_product_name.trim()
        : null) ??
      'Продукт по штрихкоду';
    const nutriments = (p.nutriments as Record<string, unknown>) ?? {};
    return {
      product: {
        name: rawName,
        carbsPer100g: toNumber(
          nutriments.carbohydrates_100g ?? nutriments.carbs_100g
        ),
        proteinPer100g: toNumber(
          nutriments.proteins_100g ?? nutriments.protein_100g
        ),
        fatPer100g: toNumber(nutriments.fat_100g ?? nutriments.fats_100g),
        sugarsPer100g: toNumber(
          nutriments.sugars_100g ?? nutriments.sugars
        ),
      },
      source: 'openfoodfacts',
    };
  } catch {
    return null;
  }
}

/**
 * Ищет товар по штрихкоду: Роскачество → Честный ЗНАК → Open Food Facts.
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
    const off = await openFoodFactsByBarcode(code);
    if (off?.product?.name) return off;
  } catch {
    // ignore
  }
  return null;
}
