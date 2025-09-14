-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lecture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
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
    "includeInMemory" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Lecture_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lecture" ("classId", "createdAt", "descriptor", "durationSec", "filePath", "id", "kind", "mime", "originalName", "segmentsJson", "status", "summaryJson", "textContent", "transcript", "updatedAt") SELECT "classId", "createdAt", "descriptor", "durationSec", "filePath", "id", "kind", "mime", "originalName", "segmentsJson", "status", "summaryJson", "textContent", "transcript", "updatedAt" FROM "Lecture";
DROP TABLE "Lecture";
ALTER TABLE "new_Lecture" RENAME TO "Lecture";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
