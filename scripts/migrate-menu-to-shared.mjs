import { PrismaClient } from '@prisma/client';

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function pushItemToShared({ serviceUrl, serviceToken, email, item }) {
  const response = await fetch(new URL('/api/menu', serviceUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Token': serviceToken,
      'X-User-Email': email,
    },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to push item "${item.name}" for ${email}: ${response.status} ${payload}`);
  }
}

async function main() {
  const serviceUrl = process.env.SHARED_MENU_SERVICE_URL;
  const serviceToken = process.env.SHARED_MENU_SERVICE_TOKEN;
  if (!serviceUrl || !serviceToken) {
    throw new Error('Set SHARED_MENU_SERVICE_URL and SHARED_MENU_SERVICE_TOKEN');
  }

  const prisma = new PrismaClient();
  try {
    const menuItems = await prisma.menuItem.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const uniqueByEmailAndName = new Map();
    for (const row of menuItems) {
      const email = row.user?.email?.trim().toLowerCase();
      if (!email) continue;
      const key = `${email}::${normalizeName(row.name)}`;
      if (!uniqueByEmailAndName.has(key)) {
        uniqueByEmailAndName.set(key, { email, row });
      }
    }

    let migrated = 0;
    for (const { email, row } of uniqueByEmailAndName.values()) {
      await pushItemToShared({
        serviceUrl,
        serviceToken,
        email,
        item: {
          name: row.name,
          carbsPer100g: row.carbsPer100g,
          caloriesPer100g: row.caloriesPer100g ?? 0,
          proteinPer100g: row.proteinPer100g ?? 0,
          fatPer100g: row.fatPer100g ?? 0,
          defaultPortionGrams: row.defaultPortionGrams ?? 100,
          recipeText: row.recipeText ?? undefined,
          hasSugar: row.hasSugar ?? false,
        },
      });
      migrated += 1;
      if (migrated % 100 === 0) {
        console.log(`Migrated ${migrated} items...`);
      }
    }

    console.log(`Done. Migrated ${migrated} unique menu items.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
