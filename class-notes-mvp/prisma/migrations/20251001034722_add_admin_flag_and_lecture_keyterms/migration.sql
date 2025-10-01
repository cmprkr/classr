-- AlterTable
ALTER TABLE "public"."Lecture" ADD COLUMN     "keyTermsJson" JSONB;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "admin" BOOLEAN NOT NULL DEFAULT false;
