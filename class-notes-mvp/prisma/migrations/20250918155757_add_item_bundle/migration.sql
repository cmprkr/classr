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
    "includeInMemoryUser" JSONB,
    "parentLectureId" TEXT,
    CONSTRAINT "Lecture_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lecture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lecture_parentLectureId_fkey" FOREIGN KEY ("parentLectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lecture" ("classId", "createdAt", "descriptor", "durationSec", "filePath", "id", "includeInMemory", "includeInMemoryUser", "kind", "mime", "originalName", "segmentsJson", "status", "summaryJson", "syncKey", "textContent", "transcript", "updatedAt", "userId") SELECT "classId", "createdAt", "descriptor", "durationSec", "filePath", "id", "includeInMemory", "includeInMemoryUser", "kind", "mime", "originalName", "segmentsJson", "status", "summaryJson", "syncKey", "textContent", "transcript", "updatedAt", "userId" FROM "Lecture";
DROP TABLE "Lecture";
ALTER TABLE "new_Lecture" RENAME TO "Lecture";
CREATE INDEX "Lecture_syncKey_idx" ON "Lecture"("syncKey");
CREATE INDEX "Lecture_createdAt_idx" ON "Lecture"("createdAt");
CREATE INDEX "Lecture_parentLectureId_idx" ON "Lecture"("parentLectureId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
