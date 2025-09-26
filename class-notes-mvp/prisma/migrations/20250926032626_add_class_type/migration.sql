-- CreateEnum
CREATE TYPE "public"."ClassType" AS ENUM ('GENERAL', 'HUMANITIES', 'MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'CS', 'ENGINEERING', 'LITERATURE', 'LANGUAGE', 'ECONOMICS', 'BUSINESS', 'LAW', 'ART', 'MUSIC', 'OTHER');

-- AlterTable
ALTER TABLE "public"."Class" ADD COLUMN     "classType" "public"."ClassType" NOT NULL DEFAULT 'GENERAL';
