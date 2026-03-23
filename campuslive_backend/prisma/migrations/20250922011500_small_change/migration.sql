/*
  Warnings:

  - You are about to drop the `event_attendances` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."RoleType" AS ENUM ('MODERATOR', 'POSTER', 'WATCHER');

-- CreateEnum
CREATE TYPE "public"."ParticipantRole" AS ENUM ('MODERATOR', 'POSTER', 'WATCHER');

-- DropForeignKey
ALTER TABLE "public"."event_attendances" DROP CONSTRAINT "event_attendances_eventId_fkey";

-- DropForeignKey
ALTER TABLE "public"."event_attendances" DROP CONSTRAINT "event_attendances_userId_fkey";

-- AlterTable
ALTER TABLE "public"."events" ADD COLUMN     "liveModeratorId" TEXT,
ADD COLUMN     "liveStartedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."event_attendances";

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleType" "public"."RoleType" NOT NULL,
    "moderatorTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."moderator_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderator_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."ParticipantRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLocationCheck" TIMESTAMP(3),

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."location_bounds" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "location_bounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mediaType" "public"."MediaType" NOT NULL,
    "thumbnailPath" TEXT,
    "durationSecs" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleType_key" ON "public"."user_roles"("userId", "roleType");

-- CreateIndex
CREATE UNIQUE INDEX "moderator_tokens_token_key" ON "public"."moderator_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "moderator_tokens_usedByUserId_key" ON "public"."moderator_tokens"("usedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_eventId_userId_key" ON "public"."event_participants"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "location_bounds_eventId_key" ON "public"."location_bounds"("eventId");

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_liveModeratorId_fkey" FOREIGN KEY ("liveModeratorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_moderatorTokenId_fkey" FOREIGN KEY ("moderatorTokenId") REFERENCES "public"."moderator_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderator_tokens" ADD CONSTRAINT "moderator_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."moderator_tokens" ADD CONSTRAINT "moderator_tokens_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."event_participants" ADD CONSTRAINT "event_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."location_bounds" ADD CONSTRAINT "location_bounds_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media" ADD CONSTRAINT "media_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media" ADD CONSTRAINT "media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
