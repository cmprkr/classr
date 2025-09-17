-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Class" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncKey" TEXT,
    "scheduleJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Class_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Class" ("createdAt", "id", "name", "scheduleJson", "syncEnabled", "syncKey", "updatedAt", "userId") SELECT "createdAt", "id", "name", "scheduleJson", "syncEnabled", "syncKey", "updatedAt", "userId" FROM "Class";
DROP TABLE "Class";
ALTER TABLE "new_Class" RENAME TO "Class";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
