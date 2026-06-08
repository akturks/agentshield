-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memoryType" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identityId" TEXT NOT NULL,
    CONSTRAINT "Memory_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
