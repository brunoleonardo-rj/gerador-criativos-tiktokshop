-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "anthropicKeyCiphertext" TEXT,
    "anthropicKeyIv" TEXT,
    "anthropicKeyTag" TEXT,
    "anthropicKeyVersion" INTEGER,
    "anthropicKeyLastFour" TEXT,
    "anthropicModel" TEXT NOT NULL DEFAULT 'claude-sonnet-5',
    "veoTemplate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LibraryVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceFilename" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "workbookPath" TEXT NOT NULL,
    "jsonPath" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "validationSummary" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "LibraryVersion_status_idx" ON "LibraryVersion"("status");
