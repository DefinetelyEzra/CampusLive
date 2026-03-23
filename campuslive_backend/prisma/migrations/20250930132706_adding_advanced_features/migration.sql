/*
  Warnings:

  - A unique constraint covering the columns `[accessKey]` on the table `events` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."RecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "public"."events" ADD COLUMN     "accessKey" TEXT,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isScheduled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentEventId" TEXT,
ADD COLUMN     "recurrenceType" "public"."RecurrenceType";

-- CreateIndex
CREATE UNIQUE INDEX "events_accessKey_key" ON "public"."events"("accessKey");

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_parentEventId_fkey" FOREIGN KEY ("parentEventId") REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
