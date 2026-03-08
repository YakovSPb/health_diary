-- AlterTable
ALTER TABLE "FoodItem" ADD COLUMN "menuItemId" TEXT,
ADD COLUMN "savedToMenu" BOOLEAN NOT NULL DEFAULT false;
