# Компоненты дневника питания

Компоненты для страницы дневника питания с функционалом добавления приёмов пищи, продуктов и расчётом инсулина.

## DiaryHeader

Header дневника с текущим сахаром, датой и кнопкой чата.

**Props:**
- `currentGlucose?: number` - текущий уровень глюкозы (ммоль/л)
- `trend?: GlucoseTrend` - тренд глюкозы (RISING, FALLING, STABLE и т.д.)
- `selectedDate: Date` - выбранная дата
- `onDateChange: (date: Date) => void` - обработчик смены даты
- `onChatOpen: () => void` - обработчик открытия чата

**Особенности:**
- Цветовая индикация сахара (красный < 4, зеленый 4-10, оранжевый > 10)
- Стрелки тренда (↑↗→↘↓)
- Навигация по дням

## MealBlock

Блок приёма пищи с временем, таблицей продуктов и кнопками действий.

**Props:**
- `id: string` - ID приёма
- `time: string` - время приёма (HH:MM)
- `totalCarbs: number` - общие углеводы
- `foodItems: FoodItem[]` - список продуктов
- `carbRatio?: number` - углеводный коэффициент для времени
- `onTimeChange` - обработчик смены времени
- `onAddFood` - обработчик добавления продукта
- `onUpdateFood` - обработчик обновления продукта
- `onDeleteFood` - обработчик удаления продукта
- `onDelete` - обработчик удаления приёма
- `onAnalyze` - обработчик анализа в AI чате

**Особенности:**
- Автоматический расчёт рекомендуемой дозы инсулина
- Inline редактирование времени
- Кнопка анализа (шестерёнка)

## FoodItemRow

Строка продукта в таблице с inline редактированием.

**Props:**
- `id: string` - ID продукта
- `name: string` - название
- `carbsPer100g: number` - углеводы на 100г
- `weightGrams: number` - вес порции в граммах
- `totalCarbs: number` - всего углеводов (расчётное)
- `onUpdate` - обработчик обновления
- `onDelete` - обработчик удаления

**Особенности:**
- Debounce автосохранение (1 секунда)
- Автоматический пересчёт totalCarbs при изменении

## VoiceInput

Компонент для голосового и текстового ввода продуктов.

**Props:**
- `onResult: (text: string) => void` - callback с распознанным текстом
- `disabled?: boolean` - флаг отключения

**Особенности:**
- Web Speech API для голосового ввода (только Chromium браузеры)
- Fallback на текстовый ввод
- Язык распознавания: русский (ru-RU)
- Визуальная индикация состояния (listening, idle)

## API Integration

### Endpoints:
- `GET /api/meals?date=YYYY-MM-DD` - получить приёмы за день
- `POST /api/meals` - создать приём
- `PATCH /api/meals/[id]` - обновить приём
- `DELETE /api/meals/[id]` - удалить приём
- `POST /api/meals/[id]/foods` - добавить продукт
- `PATCH /api/meals/[id]/foods/[foodId]` - обновить продукт
- `DELETE /api/meals/[id]/foods/[foodId]` - удалить продукт
- `POST /api/parse-food` - распарсить текст продукта через AI

### DeepSeek Integration

Используется для парсинга продуктов из текста:

```typescript
// Пример запроса
POST /api/parse-food
Body: { text: "150г яблока гала" }

// Ответ
{
  "food": {
    "name": "яблоко гала",
    "weightGrams": 150,
    "carbsPer100g": 10.5,
    "proteinPer100g": 0.4,
    "fatPer100g": 0.2
  }
}
```

## Расчёт инсулина

Формула: `доза = totalCarbs / carbRatio`

Углеводный коэффициент выбирается по времени суток:
- MORNING (06:00-10:59)
- AFTERNOON (11:00-17:59)
- EVENING (18:00-05:59)
