-- AlterTable
ALTER TABLE "news" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
