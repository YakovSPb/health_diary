/**
 * Поиск товара по штрихкоду — только Честный ЗНАК.
 */

export interface BarcodeProduct {
  name: string;
  carbsPer100g?: number;
  proteinPer100g?: number;
  fatPer100g?: number;
  sugarsPer100g?: number;
}

export type BarcodeSource = 'honest_sign';

/** Нормализует штрихкод: только цифры. */
function normalizeBarcode(barcode: string): string {
  return String(barcode).replace(/\D/g, '');
}

/**
 * Честный ЗНАК — API маркировки. Работает с кодами Data Matrix; при наличии API по EAN/GTIN — подставить вызов сюда.
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
 * Ищет товар по штрихкоду в Честном ЗНАКе.
 */
export async function findProductByBarcode(
  barcode: string
): Promise<{ product: BarcodeProduct; source: BarcodeSource } | null> {
  const code = normalizeBarcode(barcode);
  if (!code || code.length < 8) return null;
  try {
    const result = await honestSignByBarcode(code);
    if (result?.product?.name) return result;
  } catch {
    // ignore
  }
  return null;
}
