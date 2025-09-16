-- CreateTable
CREATE TABLE "LectureUserPref" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lectureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "includeInAISummary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LectureUserPref_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LectureUserPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LectureUserPref_userId_idx" ON "LectureUserPref"("userId");

-- CreateIndex
CREATE INDEX "LectureUserPref_lectureId_idx" ON "LectureUserPref"("lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "LectureUserPref_lectureId_userId_key" ON "LectureUserPref"("lectureId", "userId");
