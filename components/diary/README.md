# Компоненты дневника питания

Компоненты для страницы дневника питания с функционалом добавления приёмов пищи, продуктов и расчётом КБЖУ.

## DiaryHeader

Header дневника с датой и навигацией по дням.

**Props:**
- `selectedDate: Date` - выбранная дата
- `onDateChange: (date: Date) => void` - обработчик смены даты

**Особенности:**
- Навигация по дням

## MealBlock

Блок приёма пищи с временем, таблицей продуктов и быстрыми итогами по БЖУ/ккал.

**Props:**
- `id: string` - ID приёма
- `time: string` - время приёма (HH:MM)
- `totalCarbs: number` - общие углеводы (г)
- `totalProtein: number` - общий белок (г)
- `totalFat: number` - общий жир (г)
- `totalCalories: number` - общие калории (ккал)
- `foodItems: FoodItem[]` - список продуктов
- `onTimeChange` - обработчик смены времени
- `onAddFood` - обработчик добавления продукта
- `onUpdateFood` - обработчик обновления продукта
- `onDeleteFood` - обработчик удаления продукта
- `onDelete` - обработчик удаления приёма

**Особенности:**
- Компактный заголовок и быстрый выбор времени в попапе
- Два вида отображения продуктов: таблица (md+) и карточки (mobile)

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
