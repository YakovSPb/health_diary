# Мой доктор

Дневник питания с калориями и БЖУ для похудения.

## Возможности

- **Дневник** — приёмы пищи с подсчётом калорий, белков, жиров и углеводов. Кнопка «Анализ» по приёму: достаточно ли БЖУ, есть ли овощи, нет ли вредной пищи.
- **Меню** — сохранённые блюда с БЖУ и калориями на 100 г для быстрого добавления в дневник.
- **Профиль** — вес, рост, дата рождения (возраст).

## Стек

Next.js 16, React, TypeScript, Tailwind CSS, Prisma (SQLite), NextAuth (email/password, Google).

## Запуск

```bash
cp .env.example .env
# Обязательно задайте AUTH_SECRET (или NEXTAUTH_SECRET). Сгенерировать: npx auth secret
# Заполните DATABASE_URL, NEXTAUTH_URL (и при необходимости GOOGLE_*)

npm install
npx prisma db push
npm run dev
```

Опционально: `npm run db:seed` — тестовый пользователь test@moi-doktor.local / password123.

## Репозиторий

Инициализация нового репозитория: `git init` в папке проекта.
