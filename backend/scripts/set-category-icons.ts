/**
 * One-off: set icons on the categories import-statements.ts / categorize-imports.ts created (they
 * don't set one). Icon names must be one of the curated set in
 * client/src/components/finance/category-icon.tsx (CATEGORY_ICONS) — anything else silently falls
 * back to a letter in the UI.
 *
 * Usage: npm run set-category-icons -- --commit   (no --commit = dry run, just prints the plan)
 */
require('dotenv').config();
import prisma from '../src/middleware/prismaMiddleware';

const COMMIT = process.argv.includes('--commit');
const EMAIL = process.argv.find((a) => a.startsWith('--email='))?.slice(8) ?? 'umarsyarif1607@gmail.com';

const ICONS: [string, 'INCOME' | 'EXPENSE', string][] = [
  ['Food', 'EXPENSE', 'utensils'],
  ['Groceries & Convenience', 'EXPENSE', 'shopping-cart'],
  ['Transportation', 'EXPENSE', 'bus'],
  ['Bills & Utilities', 'EXPENSE', 'receipt'],
  ['Cash Withdrawal', 'EXPENSE', 'piggy-bank'],
  ['Shopping', 'EXPENSE', 'shopping-bag'],
  ['Entertainment & Subscriptions', 'EXPENSE', 'clapperboard'],
  ['Investments', 'EXPENSE', 'trending-up'],
  ['Interest', 'EXPENSE', 'percent'],
  ['Other', 'EXPENSE', 'circle-ellipsis'],
  ['Cashback & Rewards', 'INCOME', 'gift'],
  ['Interest', 'INCOME', 'percent'],
  ['Business & Other Income', 'INCOME', 'briefcase'],
  ['Investments', 'INCOME', 'trending-up'],
  ['Other', 'INCOME', 'circle-ellipsis'],
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error(`No user with email ${EMAIL}`);

  for (const [name, type, icon] of ICONS) {
    const category = await prisma.category.findFirst({ where: { userId: user.id, type, name } });
    if (!category) {
      console.log(`  skip (not found): ${type} ${name}`);
      continue;
    }
    console.log(`  ${type} ${name} -> ${icon}${category.icon === icon ? ' (already set)' : ''}`);
    if (COMMIT && category.icon !== icon) {
      await prisma.category.update({ where: { id: category.id }, data: { icon } });
    }
  }
  console.log(COMMIT ? '\nDone.' : '\nDry run only, nothing written. Pass --commit to apply.');
}

main()
  .catch((err) => {
    console.error(err?.message ?? String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
