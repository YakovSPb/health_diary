#!/usr/bin/env node
/**
 * Запуск prisma migrate deploy с повторами (для Vercel + Neon: холодный старт БД может давать P1002).
 * Использование: node scripts/migrate-deploy.js
 */

const { execSync } = require('child_process');

const maxAttempts = 3;
const delayMs = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
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
