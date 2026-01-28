-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ReadItem" ADD COLUMN "syncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Subscription_userPubkey_deletedAt_idx" ON "Subscription"("userPubkey", "deletedAt");

-- CreateIndex
CREATE INDEX "ReadItem_userPubkey_syncedAt_idx" ON "ReadItem"("userPubkey", "syncedAt");
