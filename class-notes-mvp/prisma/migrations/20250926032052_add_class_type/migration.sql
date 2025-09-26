-- CreateEnum
CREATE TYPE "public"."PlanTier" AS ENUM ('FREE', 'PREMIUM');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "planStatus" TEXT,
ADD COLUMN     "planTier" "public"."PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "public"."UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageCounter_userId_weekStart_idx" ON "public"."UsageCounter"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_weekStart_key" ON "public"."UsageCounter"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "User_stripeCustomerId_idx" ON "public"."User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_stripeSubscriptionId_idx" ON "public"."User"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "public"."UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
