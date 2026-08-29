-- CreateTable
CREATE TABLE "GenerationUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT,
    "model" TEXT NOT NULL,
    "creativeCount" INTEGER NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL,
    "cacheWriteTokens" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "GenerationUsage_createdAt_idx" ON "GenerationUsage"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationUsage_accountId_idx" ON "GenerationUsage"("accountId");
