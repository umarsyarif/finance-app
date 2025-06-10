/*
  Warnings:

  - A unique constraint covering the columns `[userId,isMain]` on the table `wallets` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isMain" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_isMain_key" ON "wallets"("userId", "isMain");
