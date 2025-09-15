/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lecture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'LECTURE',
    "descriptor" TEXT,
    "mime" TEXT,
    "textContent" TEXT,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "durationSec" INTEGER,
    "transcript" TEXT,
    "segmentsJson" TEXT,
    "summaryJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncKey" TEXT,
    "includeInMemory" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Lecture_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lecture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lecture" ("classId", "createdAt", "descriptor", "durationSec", "filePath", "id", "includeInMemory", "kind", "mime", "originalName", "segmentsJson", "status", "summaryJson", "syncKey", "textContent", "transcript", "updatedAt") SELECT "classId", "createdAt", "descriptor", "durationSec", "filePath", "id", "includeInMemory", "kind", "mime", "originalName", "segmentsJson", "status", "summaryJson", "syncKey", "textContent", "transcript", "updatedAt" FROM "Lecture";
DROP TABLE "Lecture";
ALTER TABLE "new_Lecture" RENAME TO "Lecture";
CREATE INDEX "Lecture_syncKey_idx" ON "Lecture"("syncKey");
CREATE INDEX "Lecture_createdAt_idx" ON "Lecture"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
