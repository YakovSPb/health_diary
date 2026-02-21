/** Извлекает вес в граммах из фразы типа "150 г гречка", "гречка 200 грамм". */
export function extractWeightFromText(phrase: string): number {
  const match = phrase.match(/(\d+)\s*(г|грамм[а-я]*|гр\.?)?/i);
  if (match) {
    const n = parseInt(match[1], 10);
    return n > 0 && n <= 10000 ? n : 100;
  }
  return 100;
}

/** Убирает из текста упоминание веса и лишние слова, оставляет название продукта. */
export function extractProductName(text: string): string {
  let cleaned = text
    .replace(/\d+\s*(г|грамм[а-я]*|гр\.?|мл|кг|л)/gi, '')
    .replace(/\b(добавь|добавить|положи|положить|запиши|записать|введи|внести)\s+/gi, '')
    .replace(/\s*(грамм|граммов|гр\.?)\s*$/gi, '')
    .trim();
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || text;
}

export interface ParsedVoiceFood {
  productName: string;
  weightGrams: number;
}

export function parseVoiceFoodText(text: string): ParsedVoiceFood {
  const trimmed = text.trim();
  const productName = extractProductName(trimmed);
  const weightGrams = extractWeightFromText(trimmed);
  return { productName: productName || trimmed, weightGrams };
}
