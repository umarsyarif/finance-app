import { execFileSync } from 'node:child_process';

// Remove e2e-* users and their data from the local `make infra` database
const sql = `
  WITH u AS (SELECT id FROM users WHERE email LIKE 'e2e-%@example.test')
  , t AS (DELETE FROM transactions WHERE "walletId" IN (SELECT id FROM wallets WHERE "userId" IN (SELECT id FROM u)))
  , w AS (DELETE FROM wallets WHERE "userId" IN (SELECT id FROM u))
  , c AS (DELETE FROM categories WHERE "userId" IN (SELECT id FROM u))
  SELECT 1;
  DELETE FROM transfers WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'e2e-%@example.test');
  DELETE FROM users WHERE email LIKE 'e2e-%@example.test';`;

export default function teardown() {
  // GitHub Actions uses a throwaway database (and has no `postgres` container to exec into)
  if (process.env.CI) return;
  execFileSync('docker', ['exec', 'postgres', 'psql', '-U', 'postgres', '-d', 'finance-app', '-qc', sql]);
}
