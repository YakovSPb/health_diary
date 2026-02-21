# Интеграция с Samsung Watch 7 (Samsung Health)

## Поток данных

```
Samsung Watch 7 → Samsung Health (на телефоне) → ваше Android-приложение → API Мой доктор
```

Данные с часов синхронизируются в приложение Samsung Health на Android. Прямого доступа к часам с веб-сервера нет. Нужно **своё Android-приложение**, которое:

1. Читает данные из **Samsung Health** (через [Samsung Health Data SDK](https://developer.samsung.com/health/data/overview.html)) или из **Health Connect** (куда Samsung Health может писать).
2. Отправляет их на наш бэкенд по API.

## Бэкенд (готово)

- **POST /api/wearable/sync** — приём данных. Авторизация: сессия (cookie) или `Authorization: Bearer <токен>`.
- **GET /api/wearable/data** — получение сохранённых данных (фильтры `from`, `to`, `type`).
- **POST /api/wearable/token** — создать токен для приложения (только по сессии). Токен показывается один раз.
- **GET /api/wearable/token** — список токенов (без самого токена).
- **DELETE /api/wearable/token?id=...** — отозвать токен (только по сессии).

### Формат POST /api/wearable/sync

```json
{
  "data": [
    { "type": "steps", "value": 8500, "unit": "count", "date": "2025-02-21T00:00:00.000Z" },
    { "type": "sleep_minutes", "value": 420, "unit": "min", "date": "2025-02-21T00:00:00.000Z" },
    { "type": "heart_rate", "value": 72, "unit": "bpm", "date": "2025-02-21T12:00:00.000Z" },
    { "type": "weight", "value": 78.5, "unit": "kg", "date": "2025-02-21T08:00:00.000Z" }
  ]
}
```

Поддерживаемые типы: `steps`, `sleep_minutes`, `heart_rate`, `weight`, `blood_oxygen`, `active_calories`, `floors_climbed`, `body_temperature`, `stress`, `water_ml`.

### Токен для приложения

1. Пользователь заходит в веб-приложение (профиль / настройки).
2. Создаёт «Токен для приложения» (вызов **POST /api/wearable/token**). В ответе приходит `token` — его нужно сохранить и ввести в Android-приложении.
3. В Android-приложении все запросы к API выполняются с заголовком:  
   `Authorization: Bearer <token>`.

## План Android-приложения

### Требования

- Android 10 (API 29) или выше.
- Samsung Health 6.30.2+ **или** Health Connect (Android 14+).
- Регистрация приложения в [Samsung Developer](https://developer.samsung.com/health/data/process.html) (для Samsung Health Data SDK).

### Шаги

1. **Создать проект** (Kotlin/Java), минимальный UI: поле для ввода URL сервера и токена, кнопка «Синхронизировать».
2. **Подключить источник данных** (один из вариантов):
   - **Samsung Health Data SDK** — [обзор](https://developer.samsung.com/health/data/overview.html), [скачать SDK](https://developer.samsung.com/health/data/overview.html#sdk-download). Читать типы: Steps, Sleep, Heart rate, Weight, Nutrition и т.д. По документации Samsung маппить в наши `type` и формат даты.
   - **Health Connect** — [документация Android](https://developer.android.com/health-and-fitness/guides/health-connect). Подходит, если данные из Samsung Health уже попадают в Health Connect.
3. **Запрос разрешений** у пользователя на чтение выбранных типов данных.
4. **Сбор данных** за выбранный период (например, за последние 24 часа или за сегодня).
5. **Отправка на сервер**: `POST {baseUrl}/api/wearable/sync` с телом как выше и заголовком `Authorization: Bearer <token>`.
6. **Периодическая синхронизация** (опционально): WorkManager или аналог раз в N часов.

### Полезные ссылки

- [Samsung Health Data SDK — обзор и типы данных](https://developer.samsung.com/health/data/overview.html)
- [Samsung Health Data SDK — процесс разработки и регистрация](https://developer.samsung.com/health/data/process.html)
- [Доступ к данным Samsung Health через Health Connect](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect)
- [Health Connect (Android)](https://developer.android.com/health-and-fitness/guides/health-connect)

### Модель данных в БД (WearableData)

| Поле      | Описание                          |
|-----------|-----------------------------------|
| userId    | Владелец (из сессии или токена)   |
| type      | Тип показателя (см. выше)         |
| value     | Числовое значение                 |
| unit      | Опционально: count, min, bpm, kg… |
| date      | Дата/время измерения (ISO 8601)   |
| source    | По умолчанию `samsung_health`     |

Дубликаты не обрабатываются автоматически: при необходимости дедупликацию (по userId, type, date) можно добавить в приложении или при вставке.
