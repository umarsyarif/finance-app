-- One main wallet per currency (data only). For every user and currency:
--   * keep the first wallet already flagged main (display order, then creation),
--   * otherwise promote the first wallet of that currency,
--   * and clear the flag on every other wallet of that currency.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "userId", currency
           ORDER BY "isMain" DESC, "displayOrder" ASC, "createdAt" ASC
         ) AS rn
  FROM "wallets"
)
UPDATE "wallets" w
SET "isMain" = (r.rn = 1)
FROM ranked r
WHERE w.id = r.id AND w."isMain" IS DISTINCT FROM (r.rn = 1);
