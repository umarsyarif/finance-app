-- Money columns: DOUBLE PRECISION -> DECIMAL(19,4)
ALTER TABLE "wallets" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(19,4);
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(19,4);

-- updatedAt (Prisma @updatedAt): backfill existing rows, then drop the default
ALTER TABLE "wallets" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "wallets" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "transactions" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "transactions" ALTER COLUMN "updatedAt" DROP DEFAULT;
