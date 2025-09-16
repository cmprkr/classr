-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startSec" INTEGER NOT NULL,
    "endSec" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "vectorJson" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chunk_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Chunk_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Chunk" ("classId", "createdAt", "endSec", "id", "lectureId", "source", "startSec", "text", "vectorJson") SELECT "classId", "createdAt", "endSec", "id", "lectureId", "source", "startSec", "text", "vectorJson" FROM "Chunk";
DROP TABLE "Chunk";
ALTER TABLE "new_Chunk" RENAME TO "Chunk";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
