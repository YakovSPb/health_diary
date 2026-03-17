-- AlterTable
ALTER TABLE "MenuItem"
ADD COLUMN     "defaultPortionGrams" DOUBLE PRECISION NOT NULL DEFAULT 100,
ADD COLUMN     "recipeText" TEXT;

