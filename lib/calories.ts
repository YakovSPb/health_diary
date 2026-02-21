/**
 * Расчёты: оптимальный вес (по ИМТ), суточная норма калорий (Mifflin-St Jeor),
 * рекомендуемый дефицит для похудения.
 */

/** Оптимальный вес (кг) по росту, ИМТ = 21.5 (середина нормы 18.5–24.5). */
export function getOptimalWeight(heightCm: number): number {
  if (heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round(heightM * heightM * 21.5 * 10) / 10;
}

/** Возраст в полных годах по дате рождения. */
export function getAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
}

/**
 * Суточная норма калорий (TDEE) по формуле Mifflin-St Jeor (усреднённый коэффициент без пола).
 * BMR = 10*weight + 6.25*height - 5*age - 78.
 * Коэффициент активности 1.375 (лёгкая активность).
 */
export function getDailyCaloriesNeeded(
  heightCm: number,
  weightKg: number,
  birthDate: Date | null
): number | null {
  if (heightCm <= 0 || weightKg <= 0) return null;
  const age = getAge(birthDate);
  if (age === null || age < 10 || age > 120) return null;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 78;
  const tdee = bmr * 1.375;
  return Math.round(Math.max(800, Math.min(5000, tdee)));
}

/** Рекомендуемый дефицит ккал/день для комфортного похудения (~0.5 кг/нед). */
export const SUGGESTED_CALORIE_DEFICIT = 500;

/** Целевое потребление ккал в день: норма минус дефицит. */
export function getTargetCaloriesPerDay(
  dailyNeeded: number,
  deficit: number
): number {
  return Math.max(0, Math.round(dailyNeeded - deficit));
}
