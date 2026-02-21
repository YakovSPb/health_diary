export function getMealName(time: string): string {
  const [hours] = time.split(':').map(Number);
  if (hours >= 6 && hours < 11) return 'Завтрак';
  if (hours >= 11 && hours < 15) return 'Обед';
  if (hours >= 15 && hours < 18) return 'Полдник';
  if (hours >= 18 && hours < 22) return 'Ужин';
  return 'Перекус';
}

export function getMealNameWithOrder(
  time: string,
  allMeals: Array<{ time: string; id?: string }>
): string {
  const baseName = getMealName(time);
  const mealsInSamePeriod = allMeals
    .filter((m) => getMealName(m.time) === baseName)
    .sort((a, b) => a.time.localeCompare(b.time));
  const idx = mealsInSamePeriod.findIndex((m) => m.time === time) + 1;
  if (mealsInSamePeriod.length <= 1) return baseName;
  if (idx === 1) return baseName;
  if (baseName === 'Завтрак') return idx === 2 ? 'Второй завтрак' : `Завтрак ${idx}`;
  if (baseName === 'Обед') return idx === 2 ? 'Второй обед' : `Обед ${idx}`;
  if (baseName === 'Полдник') return idx === 2 ? 'Второй полдник' : `Полдник ${idx}`;
  if (baseName === 'Ужин') return idx === 2 ? 'Второй ужин' : `Ужин ${idx}`;
  return idx === 2 ? 'Поздний перекус' : `Перекус ${idx}`;
}

export function formatDateForApi(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Калории из БЖУ на 100 г: 4*белки + 4*углеводы + 9*жиры */
export function caloriesFromBju(protein: number, carbs: number, fat: number): number {
  return protein * 4 + carbs * 4 + fat * 9;
}
