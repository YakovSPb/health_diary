import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Мой доктор...');

  await prisma.foodItem.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.create({
    data: {
      email: 'test@moi-doktor.local',
      name: 'Тестовый пользователь',
      password: hashedPassword,
      emailVerified: new Date(),
      height: 175,
      weight: 70,
      birthDate: new Date('1990-05-15'),
    },
  });

  console.log('✅ Создан пользователь:', user.email);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.meal.create({
    data: {
      userId: user.id,
      date: today,
      time: '08:30',
      totalCarbs: 24,
      totalProtein: 6,
      totalFat: 3,
      totalCalories: 147,
      foodItems: {
        create: [
          {
            name: 'Овсяная каша',
            carbsPer100g: 12,
            proteinPer100g: 3,
            fatPer100g: 1.5,
            weightGrams: 200,
            totalCarbs: 24,
            totalProtein: 6,
            totalFat: 3,
            totalCalories: 147,
            order: 0,
          },
        ],
      },
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { userId: user.id, name: 'Овсяная каша', carbsPer100g: 12, proteinPer100g: 3, fatPer100g: 1.5, caloriesPer100g: 73.5 },
      { userId: user.id, name: 'Гречка', carbsPer100g: 30, proteinPer100g: 12, fatPer100g: 3, caloriesPer100g: 195 },
    ],
  });

  console.log('🎉 Seeding завершён.');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
