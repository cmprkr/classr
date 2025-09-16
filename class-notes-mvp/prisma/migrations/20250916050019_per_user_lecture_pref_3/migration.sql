/*
  Warnings:

  - The primary key for the `LectureUserPref` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `LectureUserPref` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `LectureUserPref` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `LectureUserPref` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LectureUserPref" (
    "lectureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "includeInAISummary" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("lectureId", "userId"),
    CONSTRAINT "LectureUserPref_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LectureUserPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LectureUserPref" ("includeInAISummary", "lectureId", "userId") SELECT "includeInAISummary", "lectureId", "userId" FROM "LectureUserPref";
DROP TABLE "LectureUserPref";
ALTER TABLE "new_LectureUserPref" RENAME TO "LectureUserPref";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
