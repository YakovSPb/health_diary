-- CreateTable
CREATE TABLE "WearableData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT,
    "date" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'samsung_health',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WearableData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WearableSyncToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WearableSyncToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WearableData_userId_date_idx" ON "WearableData"("userId", "date");

-- CreateIndex
CREATE INDEX "WearableData_userId_type_date_idx" ON "WearableData"("userId", "type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WearableSyncToken_tokenPrefix_key" ON "WearableSyncToken"("tokenPrefix");

-- CreateIndex
CREATE INDEX "WearableSyncToken_userId_idx" ON "WearableSyncToken"("userId");
