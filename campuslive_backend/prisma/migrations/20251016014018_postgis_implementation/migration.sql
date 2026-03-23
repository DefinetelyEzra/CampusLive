/*
  Warnings:

  - You are about to drop the column `bounds_geom` on the `location_bounds` table. All the data in the column will be lost.
  - You are about to drop the column `center_geom` on the `location_bounds` table. All the data in the column will be lost.
  - You are about to drop the column `geom` on the `locations` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."location_bounds_bounds_geom_idx";

-- DropIndex
DROP INDEX "public"."location_bounds_center_geom_idx";

-- DropIndex
DROP INDEX "public"."locations_geom_idx";

-- AlterTable
ALTER TABLE "public"."location_bounds" DROP COLUMN "bounds_geom",
DROP COLUMN "center_geom";

-- AlterTable
ALTER TABLE "public"."locations" DROP COLUMN "geom";
