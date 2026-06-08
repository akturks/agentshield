-- CreateTable
CREATE TABLE "TrustAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trustScore" INTEGER NOT NULL,
    "confidence" REAL NOT NULL,
    "intent" TEXT NOT NULL,
    "assessmentTimestamp" DATETIME NOT NULL,
    "identityId" TEXT NOT NULL,
    CONSTRAINT "TrustAssessment_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
