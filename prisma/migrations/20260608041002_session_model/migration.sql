-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identityId" TEXT NOT NULL,
    CONSTRAINT "Session_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "path" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "sessionId" TEXT,
    "riskScore" INTEGER,
    "decision" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identityId" TEXT NOT NULL,
    CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("createdAt", "decision", "eventType", "id", "identityId", "ip", "path", "riskScore", "userAgent") SELECT "createdAt", "decision", "eventType", "id", "identityId", "ip", "path", "riskScore", "userAgent" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
