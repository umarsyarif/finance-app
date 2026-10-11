-- CreateTable
CREATE TABLE "asset_lots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "totalPaid" DECIMAL(19,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_costs" (
    "userId" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "costAmount" DECIMAL(19,4) NOT NULL,
    "costCurrency" TEXT NOT NULL,

    CONSTRAINT "asset_costs_pkey" PRIMARY KEY ("userId","assetClass","symbol")
);

-- CreateTable
CREATE TABLE "binance_connections" (
    "userId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binance_connections_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "asset_lots_userId_assetClass_symbol_idx" ON "asset_lots"("userId", "assetClass", "symbol");

-- AddForeignKey
ALTER TABLE "asset_lots" ADD CONSTRAINT "asset_lots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_costs" ADD CONSTRAINT "asset_costs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binance_connections" ADD CONSTRAINT "binance_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
