-- AlterTable
ALTER TABLE "users" ADD COLUMN     "apiTokenCreatedAt" TIMESTAMP(3),
ADD COLUMN     "apiTokenHash" TEXT,
ADD COLUMN     "apiTokenLastUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_apiTokenHash_key" ON "users"("apiTokenHash");

