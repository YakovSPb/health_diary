#!/usr/bin/env node
/**
 * Запуск prisma migrate deploy с повторами (для Vercel + Neon: холодный старт БД и P1002 advisory lock).
 * Перед запуском лучше остановить dev-сервер (npm run dev), чтобы не держать соединения с БД.
 * Использование: node scripts/migrate-deploy.js
 */

const maxAttempts = 5;
const delayMs = 12000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { execSync } = await import('node:child_process');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.warn(`[migrate-deploy] Попытка ${attempt}/${maxAttempts}...`);
      }
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env },
      });
      process.exit(0);
    } catch (err) {
      if (attempt < maxAttempts) {
        console.warn(
          `[migrate-deploy] Попытка ${attempt}/${maxAttempts} не удалась. Повтор через ${delayMs / 1000}с...`
        );
        await sleep(delayMs);
      } else {
        process.exit(err.status ?? 1);
      }
    }
  }
}

main();
