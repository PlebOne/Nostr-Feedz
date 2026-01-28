-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN "nostrRelays" TEXT[] DEFAULT ARRAY[]::TEXT[];
